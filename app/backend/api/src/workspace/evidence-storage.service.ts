import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  acceptedEvidenceExtensions,
  EvidenceItem,
  evidenceExtensionMessage,
  evidenceFileExtension,
  maxEvidenceFileSize,
} from '../onboarding/evidence-item.schema';
import { EvidenceFile } from './evidence-file.schema';
import { readOfficeText } from './office-text';

export type UploadedEvidence = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type StoredFile = {
  _id?: Types.ObjectId;
  name: string;
  storedAs: string;
  text?: string;
  textTruncated?: boolean;
};

/** Types whose bytes are plain text, so the agent can read them without a parser. */
const readableExtensions = ['.csv', '.json'];
/** OOXML packages: ZIP archives of XML, read by `office-text.ts`. */
const officeExtensions = ['.xlsx', '.docx'];
const maxStoredChars = 20000;
const maxStoredLines = 240;
const maxReadBytes = 512 * 1024;

/** Prompt budget per turn: enough to answer from a real file without crowding the setup block. */
const promptCharsPerFile = 12000;
const promptCharsTotal = 24000;

@Injectable()
export class EvidenceStorageService {
  private readonly root: string;

  constructor(
    private readonly config: ConfigService,
    @InjectModel(EvidenceFile.name) private readonly files: Model<EvidenceFile>,
    @InjectModel(EvidenceItem.name) private readonly items: Model<EvidenceItem>,
  ) {
    this.root = resolve(this.config.get<string>('EVIDENCE_STORAGE_DIR', 'storage/evidence'));
  }

  async store(userId: string, uploads: UploadedEvidence[]) {
    if (!uploads.length) throw new BadRequestException('Choose at least one file to attach.');
    const owner = new Types.ObjectId(userId);

    const stored = await Promise.all(uploads.map((upload) => this.storeOne(owner, upload)));
    return { status: true, message: 'Evidence attached successfully', data: stored };
  }

  async list(userId: string) {
    const owner = new Types.ObjectId(userId);
    const found = await this.files.find({ userId: owner }).sort({ createdAt: -1 }).limit(25).lean().exec();
    return {
      status: true,
      data: found.map((file) => ({
        id: file._id?.toString(),
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        readable: Boolean(file.text),
        createdAt: (file.createdAt ?? new Date()).toISOString(),
      })),
    };
  }

  /**
   * The content section of the agent prompt plus the labels for the files the
   * customer pinned. `attachmentIds` pins what was just attached; the remaining
   * budget fills with other readable files, so a follow-up question about a
   * file mentioned earlier still has its contents in front of the model.
   */
  async prepare(userId: string, attachmentIds: string[] = []) {
    const owner = new Types.ObjectId(userId);
    const found = await this.files
      .find({ userId: owner })
      .sort({ createdAt: -1 })
      .limit(25)
      .lean()
      .exec();
    await this.backfillText(owner, found);

    const pinned = new Set(attachmentIds.filter((id) => Types.ObjectId.isValid(id)));
    const attached = found
      .filter((file) => pinned.has(file._id?.toString()))
      .map((file) => ({ name: file.name, size: file.size, readable: Boolean(file.text) }));

    const readable = found.filter((file) => Boolean(file.text));
    if (!readable.length) return { block: '', attached };

    const ordered = [
      ...readable.filter((file) => pinned.has(file._id?.toString())),
      ...readable.filter((file) => !pinned.has(file._id?.toString())),
    ];

    const blocks: string[] = [];
    let spent = 0;
    for (const file of ordered) {
      if (spent >= promptCharsTotal) { blocks.push('[Additional attached files are listed by name only in this turn.]'); break; }
      const room = Math.min(promptCharsPerFile, promptCharsTotal - spent);
      const body = (file.text ?? '').slice(0, room);
      spent += body.length;
      blocks.push(`### ${file.name} (${(file.textTruncated ? 'partially ' : '')}stored, ${this.formatSize(file.size)})\n${body}`);
    }

    return { block: `\n\n--- UPLOADED EVIDENCE CONTENTS ---\n${blocks.join('\n\n')}`, attached };
  }

  /** Files stored before their type became readable still have their bytes on disk. */
  private async backfillText(owner: Types.ObjectId, found: StoredFile[]) {
    const extractable = [...readableExtensions, ...officeExtensions];
    const pending = found
      .filter((file) => !file.text && extractable.includes(evidenceFileExtension(file.name)))
      .slice(0, 5);
    for (const file of pending) {
      try {
        const buffer = await readFile(join(this.root, owner.toString(), file.storedAs));
        const extracted = this.extract(buffer, evidenceFileExtension(file.name));
        if (!extracted?.text) continue;
        await this.files.updateOne(
          { _id: file._id },
          { $set: { text: extracted.text, textTruncated: extracted.truncated } },
        );
        file.text = extracted.text;
        file.textTruncated = extracted.truncated;
      } catch {
        // A file that is no longer on disk stays a name-only attachment.
      }
    }
  }

  private async storeOne(owner: Types.ObjectId, upload: UploadedEvidence) {
    const name = this.displayName(upload.originalname);
    const extension = evidenceFileExtension(name);
    if (!acceptedEvidenceExtensions.includes(extension as typeof acceptedEvidenceExtensions[number])) {
      throw new BadRequestException(`${name}: ${evidenceExtensionMessage}`);
    }
    if (!upload.size) throw new BadRequestException(`${name} is empty, so it cannot be added.`);
    if (upload.size > maxEvidenceFileSize) throw new BadRequestException(`${name} is larger than 25 MB.`);
    if (!upload.buffer?.length) throw new BadRequestException(`${name} could not be read.`);

    const storedAs = `${randomUUID()}${extension}`;
    const target = join(this.root, owner.toString(), storedAs);
    try {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, upload.buffer);
    } catch {
      throw new ServiceUnavailableException(`${name} could not be stored on this server.`);
    }

    const extracted = this.extract(upload.buffer, extension);
    const record = await this.files.findOneAndUpdate(
      { userId: owner, name },
      {
        $set: {
          userId: owner,
          name,
          size: upload.size,
          mimeType: upload.mimetype || 'application/octet-stream',
          storedAs,
          textTruncated: extracted?.truncated ?? false,
          ...(extracted ? { text: extracted.text } : {}),
        },
        // Re-attaching a non-readable file of the same name must not keep stale content.
        ...(!extracted ? { $unset: { text: '' } } : {}),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    // The onboarding step edits this descriptor; a workspace upload must appear in the same list.
    await this.items.findOneAndUpdate(
      { userId: owner, name },
      {
        $set: { size: upload.size },
        $setOnInsert: { userId: owner, name, category: 'Other', period: 'Other' },
      },
      { upsert: true, runValidators: true },
    );

    const id = record?._id?.toString() ?? new Types.ObjectId().toString();
    return { id, name, size: upload.size, mimeType: upload.mimetype, readable: Boolean(extracted?.text) };
  }

  private extract(buffer: Buffer, extension: string) {
    if (officeExtensions.includes(extension)) return readOfficeText(buffer, extension);
    if (!readableExtensions.includes(extension)) return undefined;
    const raw = buffer.subarray(0, maxReadBytes).toString('utf8');
    // A NUL byte in the opening window means the payload is not really text.
    if (raw.includes('\u0000')) return undefined;

    const lines = raw.split(/\r?\n/);
    const kept = extension === '.csv'
      ? lines.slice(0, maxStoredLines).join('\n')
      : this.compactJson(raw) ?? raw;

    const truncated = kept.length > maxStoredChars || (extension === '.csv' && lines.length > maxStoredLines);
    return { text: kept.slice(0, maxStoredChars), truncated };
  }

  private compactJson(raw: string) {
    try { return JSON.stringify(JSON.parse(raw)); } catch { return undefined; }
  }

  private displayName(originalname: string) {
    const base = originalname.replace(/^.*[\\/]/, '').trim().slice(0, 255);
    return base || 'untitled';
  }

  private formatSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return 'unknown size';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
