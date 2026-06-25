import IrcRenderer from "./IrcRenderer.js";
import CleanRenderer from "./CleanRenderer.js";
import FountainRenderer from "./FountainRenderer.js";

export default class RendererFactory {
  static getRenderer(mode, ui) {
    const upperMode = mode.toUpperCase();
    switch (upperMode) {
      case "FOUNTAIN":
        return new FountainRenderer(ui);
      case "CLEAN":
        return new CleanRenderer(ui);
      case "IRC":
      default:
        return new IrcRenderer(ui);
    }
  }
}
