/** 最小限の WAV(PCM) ユーティリティ。VOICEVOX出力の結合とモック生成に使う。 */

interface WavInfo {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  byteRate: number;
  blockAlign: number;
  data: Buffer;
}

function findChunk(buf: Buffer, id: string, start: number): { offset: number; size: number } | null {
  let off = start;
  while (off + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (chunkId === id) return { offset: off + 8, size };
    off += 8 + size + (size % 2); // チャンクは偶数バイト境界
  }
  return null;
}

export function parseWav(buf: Buffer): WavInfo {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  const fmt = findChunk(buf, 'fmt ', 12);
  if (!fmt) throw new Error('fmt chunk not found');
  const audioFormat = buf.readUInt16LE(fmt.offset);
  const channels = buf.readUInt16LE(fmt.offset + 2);
  const sampleRate = buf.readUInt32LE(fmt.offset + 4);
  const byteRate = buf.readUInt32LE(fmt.offset + 8);
  const blockAlign = buf.readUInt16LE(fmt.offset + 12);
  const bitsPerSample = buf.readUInt16LE(fmt.offset + 14);

  const dataChunk = findChunk(buf, 'data', 12);
  if (!dataChunk) throw new Error('data chunk not found');
  const data = buf.subarray(dataChunk.offset, dataChunk.offset + dataChunk.size);

  return { audioFormat, channels, sampleRate, bitsPerSample, byteRate, blockAlign, data };
}

export function wavDurationSec(buf: Buffer): number {
  const info = parseWav(buf);
  return info.data.length / info.byteRate;
}

function encodeWav(info: Omit<WavInfo, 'byteRate' | 'blockAlign'>): Buffer {
  const { audioFormat, channels, sampleRate, bitsPerSample, data } = info;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(audioFormat, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** 同一フォーマット前提で複数WAVのPCMを連結し、各尺(秒)も返す */
export function concatWavs(buffers: Buffer[]): { wav: Buffer; durations: number[] } {
  if (buffers.length === 0) throw new Error('no buffers to concat');
  const infos = buffers.map(parseWav);
  const first = infos[0];
  const durations = infos.map((i) => i.data.length / i.byteRate);
  const data = Buffer.concat(infos.map((i) => i.data));
  const wav = encodeWav({
    audioFormat: first.audioFormat,
    channels: first.channels,
    sampleRate: first.sampleRate,
    bitsPerSample: first.bitsPerSample,
    data,
  });
  return { wav, durations };
}

/** 指定秒数の無音WAV（24kHz/16bit/mono） */
export function silentWav(seconds: number, sampleRate = 24000): Buffer {
  const samples = Math.max(1, Math.round(seconds * sampleRate));
  const data = Buffer.alloc(samples * 2); // 16bit mono → ゼロ埋め
  return encodeWav({ audioFormat: 1, channels: 1, sampleRate, bitsPerSample: 16, data });
}
