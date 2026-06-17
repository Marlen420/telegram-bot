import { execFileSync } from 'child_process';

export interface VideoDimensions {
  width: number;
  height: number;
}

export function getVideoDimensions(filePath: string): VideoDimensions | null {
  try {
    const output = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-show_entries',
        'stream_tags=rotate',
        '-of',
        'json',
        filePath,
      ],
      { encoding: 'utf-8' },
    );

    const data = JSON.parse(output) as {
      streams?: Array<{ width?: number; height?: number; tags?: { rotate?: string } }>;
    };

    const stream = data.streams?.[0];
    if (!stream?.width || !stream?.height) {
      return null;
    }

    let width = stream.width;
    let height = stream.height;
    const rotate = Number.parseInt(stream.tags?.rotate ?? '0', 10);

    if (rotate === 90 || rotate === 270) {
      [width, height] = [height, width];
    }

    return { width, height };
  } catch {
    return null;
  }
}
