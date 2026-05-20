import Jimp from 'jimp';
import ConfigManager from "../core/configManager.js";

export class UtilTools {
  async validateJson({ json_string }) {
    try {
      JSON.parse(json_string);
      return "El JSON es valido.";
    } catch (e) {
      return `ERR: JSON invalido: ${e.message}`;
    }
  }

  async setNickname({ newNickname }) {
    try {
      const config = new ConfigManager();
      const oldNickname = config.get("agent_nickname", "paser_mini");
      config.save("agent_nickname", newNickname);
      return `*** ${oldNickname} is now known as ${newNickname}`;
    } catch (e) {
      return `ERR: Failed to update nickname: ${e.message}`;
    }
  }

  async seeImage({ path: imagePath, crop }) {
    if (!imagePath) throw new Error("The 'path' parameter is required.");

    try {
      const image = await Jimp.read(imagePath);

      if (crop) {
        if (!Array.isArray(crop) || crop.length !== 4) {
          throw new Error("The 'crop' parameter must be an array of 4 integers: [left, top, right, bottom].");
        }
        const [left, top, right, bottom] = crop;
        const width = right - left;
        const height = bottom - top;
        if (width <= 0 || height <= 0) {
          throw new Error("Invalid crop dimensions: right must be > left and bottom must be > top.");
        }
        image.crop(left, top, width, height);
      }

      const width = image.bitmap.width;
      const height = image.bitmap.height;
      const aspectRatio = width / height;
      
      let newWidth, newHeight;
      const MIN_VISUAL_RESOLUTION = 512;

      if (width < height) {
        newWidth = MIN_VISUAL_RESOLUTION;
        newHeight = Math.round(MIN_VISUAL_RESOLUTION / aspectRatio);
      } else {
        newHeight = MIN_VISUAL_RESOLUTION;
        newWidth = Math.round(MIN_VISUAL_RESOLUTION * aspectRatio);
      }

      image.resize(newWidth, newHeight);

      const buffer = await image
        .quality(85)
        .getBufferAsync(Jimp.MIME_JPEG);

      const base64Data = buffer.toString('base64');

      return JSON.stringify({
        mime_type: "image/jpeg",
        data: base64Data,
        resolution: `${newWidth}x${newHeight}`
      });
    } catch (error) {
      throw new Error(`Vision Tool Error: ${error.message}`);
    }
  }
}