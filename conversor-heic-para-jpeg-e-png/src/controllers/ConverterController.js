const FileService = require('../services/FileService');
const ImageService = require('../services/ImageService');

class ConverterController {

    async scan(req, res) {
        try {
            const { folderPath, inputType } = req.body;
            if (!folderPath) {
                return res.status(400).json({ error: 'Folder path is required' });
            }

            const files = await FileService.scanDirectory(folderPath, inputType);
            res.json({ count: files.length, files: files });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async convertStream(req, res) {
        const { folderPath, outputFormat, quality, inputType } = req.query;

        console.log("Starting stream conversion...");

        if (!folderPath) {
            return res.status(400).send('Folder path is required');
        }

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const sendEvent = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            const result = await ImageService.convertDirectory(
                folderPath,
                outputFormat,
                quality,
                inputType,
                (progressData) => {
                    sendEvent(progressData);
                }
            );

            sendEvent({ type: 'complete', result });
            res.end();
        } catch (error) {
            console.error("Stream conversion error:", error);
            sendEvent({ type: 'fatal_error', error: error.message });
            res.end();
        }
    }

    // Deprecated non-stream method, kept for reference
    async convert(req, res) {
        try {
            const { folderPath, outputFormat, quality } = req.body;

            if (!folderPath) {
                return res.status(400).json({ error: 'Folder path is required' });
            }

            const result = await ImageService.convertDirectory(folderPath, outputFormat, quality);
            res.json({ success: true, ...result });

        } catch (error) {
            console.error("Global conversion error:", error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ConverterController();
