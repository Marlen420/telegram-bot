import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface VideoSection {
  message: string;
  caption: string;
  video: string;
}

export interface TicketsSection {
  message: string;
  buttonText: string;
}

export interface ContentConfig {
  welcome: string;
  fallback: string;
  sections: {
    about: VideoSection;
    prices: VideoSection;
    bonuses: VideoSection;
    tickets: TicketsSection;
  };
}

function loadContentConfig(configPath: string): ContentConfig {
  const absolutePath = path.resolve(configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Content config not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(raw) as ContentConfig;
}

const contentConfigPath = process.env.CONTENT_CONFIG_PATH ?? './config/content.json';
const videosDir = process.env.VIDEOS_DIR ?? './videos';

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  databaseUrl: requireEnv('DATABASE_URL'),
  ticketUrl: requireEnv('TICKET_URL'),
  port: Number(process.env.PORT ?? 3000),
  statsUser: process.env.STATS_USER ?? 'admin',
  statsPassword: process.env.STATS_PASSWORD ?? '',
  contentConfigPath,
  videosDir: path.resolve(videosDir),
  content: loadContentConfig(contentConfigPath),
};

const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.MP4', '.mov', '.MOV'];

export function resolveVideoPath(filename: string): string | null {
  const exactPath = path.join(config.videosDir, filename);
  if (fs.existsSync(exactPath)) {
    return exactPath;
  }

  const baseName = path.extname(filename)
    ? path.basename(filename, path.extname(filename))
    : filename;

  for (const ext of SUPPORTED_VIDEO_EXTENSIONS) {
    const candidate = path.join(config.videosDir, baseName + ext);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
