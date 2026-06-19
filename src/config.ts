import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { backToMenuKeyboard, buyInlineKeyboard, mainMenuKeyboard, ticketsInlineKeyboard, ticketsKeyboard, welcomeInlineKeyboard } from './keyboards';

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
  cta?: string;
}

export interface TicketsSection {
  message: string;
}

export interface PaymentTexts {
  socialProof: string;
  qrInstructions: string;
  needFio: string;
  needReceipt: string;
  invalidReceipt: string;
  completed: string;
  reminder: string;
}

export interface ContentConfig {
  welcome: string;
  welcomeCta?: string;
  fallback: string;
  sections: {
    about: VideoSection;
    prices: VideoSection;
    bonuses: VideoSection;
    tickets: TicketsSection;
  };
  payment: PaymentTexts;
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
const imagesDir = process.env.IMAGES_DIR ?? './images';
const forwardToChatIdRaw = process.env.FORWARD_TO_CHAT_ID;
const qrImageName = process.env.QR_IMAGE_NAME ?? 'qr-payment';

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  databaseUrl: requireEnv('DATABASE_URL'),
  ticketUrl: requireEnv('TICKET_URL'),
  port: Number(process.env.PORT ?? 3000),
  statsUser: process.env.STATS_USER ?? 'admin',
  statsPassword: process.env.STATS_PASSWORD ?? '',
  forwardToChatId: forwardToChatIdRaw ? Number(forwardToChatIdRaw) : null,
  forwardToUsername: process.env.FORWARD_TO_USERNAME ?? 'pratovv',
  contentConfigPath,
  videosDir: path.resolve(videosDir),
  imagesDir: path.resolve(imagesDir),
  qrImageName,
  content: loadContentConfig(contentConfigPath),
  mainMenuKeyboard,
  ticketsKeyboard,
  backToMenuKeyboard,
  welcomeInlineKeyboard,
  buyInlineKeyboard,
  ticketsInlineKeyboard,
};

const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.MP4', '.mov', '.MOV'];
const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.PNG', '.jpg', '.JPG', '.jpeg', '.JPEG'];

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

export function resolveQrImagePath(): string | null {
  for (const ext of SUPPORTED_IMAGE_EXTENSIONS) {
    const candidate = path.join(config.imagesDir, config.qrImageName + ext);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveImagePath(imageName: string): string | null {
  for (const ext of SUPPORTED_IMAGE_EXTENSIONS) {
    const candidate = path.join(config.imagesDir, imageName + ext);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
