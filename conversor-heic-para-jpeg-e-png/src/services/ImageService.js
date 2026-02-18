const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const FileService = require('./FileService');

const readFile = promisify(fs.readFile);

class ImageService {
    async convertDirectory(folderPath, outputFormat, quality, onProgress) {
        const heicFiles = await FileService.scanDirectory(folderPath);
        const outputDir = path.join(folderPath, 'converted');

        await FileService.ensureDirectoryExists(outputDir);

        const results = [];
        let successCount = 0;

        for (const file of heicFiles) {
            const inputPath = path.join(folderPath, file);
            const outputFilename = path.basename(file, path.extname(file)) + '.' + outputFormat;
            const outputPath = path.join(outputDir, outputFilename);

            if (onProgress) onProgress({ type: 'start', file });

            try {
                await this.processSingleFile(inputPath, outputPath, outputFormat, quality);
                successCount++;
                results.push({ file, status: 'success' });
                if (onProgress) onProgress({ type: 'success', file });
            } catch (err) {
                console.error(`Error converting ${file}:`, err);
                results.push({ file, status: 'error', error: err.message });
                if (onProgress) onProgress({ type: 'error', file, error: err.message });
            }
        }

        return {
            total: heicFiles.length,
            converted: successCount,
            outputDir,
            results
        };
    }

    async processSingleFile(inputPath, outputPath, format, quality) {
        const inputBuffer = await readFile(inputPath);

        // Decode HEIC
        let imageBuffer;
        try {
            imageBuffer = await sharp(inputBuffer).toBuffer();
        } catch (e) {
            // console.log(`Sharp failed to decode, trying heic-convert fallback...`);
            imageBuffer = await heicConvert({
                buffer: inputBuffer,
                format: 'PNG'
            });
        }

        // Optimize with sharp
        let pipeline = sharp(imageBuffer);

        if (format === 'jpeg') {
            pipeline = pipeline.jpeg({
                quality: parseInt(quality) || 80,
                mozjpeg: true
            });
        } else if (format === 'png') {
            pipeline = pipeline.png({
                quality: parseInt(quality) || 80,
                compressionLevel: 8,
                adaptiveFiltering: true
            });
        }

        await pipeline.toFile(outputPath);
    }
}

module.exports = new ImageService();
