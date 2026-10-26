import { BadRequestException } from '@nestjs/common';
import {
  dataIntakeExtensionMessage,
  dataIntakeExtensionOf,
  DataIntakeExtension,
  dataIntakeExtensions,
  maxDataIntakeFileSize,
} from './data-intake.constants';

export type UploadedDataFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type PreparedDataFile = {
  name: string;
  size: number;
  mimeType: string;
  extension: DataIntakeExtension;
  buffer: Buffer;
};

const mimeTypes: Record<DataIntakeExtension, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export function displayName(originalname: string) {
  const base = originalname.replace(/^.*[\\/]/, '').trim().slice(0, 255);
  return base || 'untitled';
}

export function prepareUpload(upload: UploadedDataFile): PreparedDataFile {
  const name = displayName(upload.originalname);
  const extension = dataIntakeExtensionOf(name);
  if (!dataIntakeExtensions.includes(extension as DataIntakeExtension)) {
    throw new BadRequestException(`${name}: ${dataIntakeExtensionMessage}`);
  }
  if (!upload.size) throw new BadRequestException(`${name} is empty, so it cannot be added.`);
  if (upload.size > maxDataIntakeFileSize) throw new BadRequestException(`${name} is larger than 25 MB.`);
  if (!upload.buffer?.length) throw new BadRequestException(`${name} could not be read.`);
  if (!hasExpectedSignature(upload.buffer, extension as DataIntakeExtension)) {
    throw new BadRequestException(`${name} does not look like a valid ${extension.slice(1).toUpperCase()} file.`);
  }

  const typedExtension = extension as DataIntakeExtension;
  return {
    name,
    size: upload.size,
    mimeType: mimeTypes[typedExtension],
    extension: typedExtension,
    buffer: upload.buffer,
  };
}

function hasExpectedSignature(buffer: Buffer, extension: DataIntakeExtension) {
  if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (extension === '.png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (extension === '.docx' || extension === '.xlsx') {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }
  return !buffer.subarray(0, 512).includes(0);
}
