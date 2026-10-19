const { randomBytes, scryptSync } = require('node:crypto');

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
  process.stderr.write('Run this helper in an interactive terminal so the password can be entered without echo.\n');
  process.exit(1);
}

process.stdout.write('New admin password (input hidden): ');
process.stdin.setRawMode(true);
process.stdin.resume();
let input = '';

process.stdin.on('data', (chunk) => {
  for (const character of chunk.toString('utf8')) {
    if (character === '\u0003') {
      process.stdout.write('\nCancelled.\n');
      process.exit(1);
    }
    if (character === '\r' || character === '\n') {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (input.length < 16 || input.length > 256) {
        process.stderr.write('Use a password between 16 and 256 characters.\n');
        process.exit(1);
      }
      const salt = randomBytes(16).toString('hex');
      const key = scryptSync(input, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
      input = '';
      process.stdout.write(`ADMIN_PASSWORD_HASH=scrypt$32768$8$1$${salt}$${key.toString('hex')}\n`);
      process.exit(0);
    }
    if (character === '\u007f' || character === '\b') input = input.slice(0, -1);
    else if (character >= ' ') input += character;
  }
});
