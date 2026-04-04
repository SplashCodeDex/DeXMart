import fs from 'fs';
import { spawn } from 'child_process';

export const imageToWebp = async (buffer: Buffer) => {
  return buffer;
};


export const videoToWebp = async (buffer: Buffer) => {
  return buffer;
};


export const writeExifImg = async (buffer: Buffer, metadata: any) => {
  return buffer;
};


export const writeExifVid = async (buffer: Buffer, metadata: any) => {
  return buffer;
};


export const writeExif = writeExifImg;

export default {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid,
  writeExif,
};
