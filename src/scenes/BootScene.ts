import { Scene } from "phaser";
import { TsxParser } from "../utils/TsxParser";

interface GridConfig {
  rows: number;
  columns: number;
  spriteWidth: number;
  spriteHeight: number;
}

interface AnimationConfig {
  path: string;
  skins: string[];
  grid: GridConfig;
  animationStrategy: "loop" | "freeze";
}

interface AnimationMap {
  [key: string]: AnimationConfig;
}

interface MapsMap {
  [key: string]: string;
}

interface SoundsMap {
  [key: string]: string;
}

interface ItemsMap {
  [key: string]: { id: string };
}

interface ExternalTsx {
  mapKey: string;
  tilesetIndex: number;
  source: string;
  cacheKey: string;
  url: string;
}

interface TilesetImage {
  key: string;
  url: string;
}

export class BootScene extends Scene {
  private animationMap!: AnimationMap;
  private mapsMap!: MapsMap;
  private soundsMap!: SoundsMap;
  private itemsMap!: ItemsMap;

  constructor() {
    super({ key: "BootScene" });
  }

  /** 等待 CSS @font-face 字体加载完成 */
  private async loadFonts(): Promise<void> {
    // 使用相对路径，确保在 file:// 协议下（Electron 生产模式）也能正确解析
    const fonts: FontFace[] = [
      new FontFace("VonwaonBitmap12", "url(fonts/VonwaonBitmap-12px.ttf)"),
      new FontFace("VonwaonBitmap16", "url(fonts/VonwaonBitmap-16px.ttf)"),
    ];
    for (const font of fonts) {
      try {
        const loaded = await font.load();
        document.fonts.add(loaded);
      } catch {
        console.warn(`[BootScene] 字体加载失败: ${font.family}`);
      }
    }
  }

  preload(): void {
    // 加载资源映射表
    this.load.json("animation", "data/animation.json");
    this.load.json("maps", "data/maps.json");
    this.load.json("sounds", "data/sounds.json");
    this.load.json("items", "data/items.json");
    this.load.json("drops", "data/drops.json");
    this.load.json("buffs", "data/buffs.json");
  }

  async create(): Promise<void> {
    // 等待自定义位图字体加载完成
    await this.loadFonts();

    this.animationMap = this.cache.json.get("animation") as AnimationMap;
    this.mapsMap = this.cache.json.get("maps") as MapsMap;
    this.soundsMap = this.cache.json.get("sounds") as SoundsMap;
    this.itemsMap = this.cache.json.get("items") as ItemsMap;

    // ========== 第 1 步：加载所有地图 JSON（支持场景切换）==========
    for (const [key, path] of Object.entries(this.mapsMap)) {
      this.load.tilemapTiledJSON(key, path.replace(".tmx", ".json"));
    }
    await this.loadResources();

    // ========== 第 2 步：加载外部 .tsx tileset 文件 ==========
    const externalTsxs = this.collectExternalTilesets();
    if (externalTsxs.length > 0) {
      console.log(`[BootScene] 发现 ${externalTsxs.length} 个外部 tileset，运行时内嵌`);
      for (const tsx of externalTsxs) {
        this.load.text(tsx.cacheKey, tsx.url);
      }
      await this.loadResources();
    }

    // ========== 第 3 步：内嵌外部 tileset 并预加载所有 tileset 图片 ==========
    const embeddedImages = this.collectEmbeddedTilesetImages();
    const externalImages = this.parseExternalTilesets(externalTsxs);
    const tilesetImages = [...embeddedImages, ...externalImages];
    console.log('[BootScene] 预加载 tileset 图片:', tilesetImages.map(i => `${i.key} -> ${i.url}`));
    for (const img of tilesetImages) {
      this.load.image(img.key, img.url);
    }
    await this.loadResources();
    console.log('[BootScene] tileset 图片加载完成');

    // ========== 第 4 步：加载角色 spritesheets（支持多皮肤）==========
    for (const [key, config] of Object.entries(this.animationMap)) {
      const basePath = config.path;
      // 规范化路径：确保以 / 结尾
      const normalizedPath = basePath.endsWith("/") ? basePath : basePath + "/";
      for (const skin of config.skins) {
        const skinName = skin.replace(/\.png$/i, "");
        const isDefault = skinName === "default";
        const textureKey = isDefault ? key : `${key}_${skinName}`;
        const filePath = normalizedPath + skin;

        this.load.spritesheet(textureKey, filePath, {
          frameWidth: config.grid.spriteWidth,
          frameHeight: config.grid.spriteHeight,
        });
      }
    }

    // 加载缺图回退占位符：所有未找到纹理的统一回退
    this.load.image("item_notfind", "images/notfind.png");
    for (const itemId of Object.keys(this.itemsMap)) {
      this.load.image(`item_${itemId}`, `images/item/${itemId}.png`);
    }
    // 加载失败时记录警告，渲染层会自动回退到 item_notfind
    this.load.on("loaderror", (file: { key: string }) => {
      if (file.key.startsWith("item_")) {
        console.warn(
          `[BootScene] 道具图标缺失: ${file.key}，将使用 notfind 占位`,
        );
      }
    });

    // 加载音效
    for (const [key, path] of Object.entries(this.soundsMap)) {
      this.load.audio(key, path);
    }

    await this.loadResources();

    // ========== 初始化：创建动画、纹理，启动 GameScene ==========
    this.createAnimations();
    this.createProjectileTexture();

    // 将默认地图 key 传递给 GameScene
    const defaultMapKey = Object.keys(this.mapsMap)[0];
    this.scene.start("GameScene", { mapKey: defaultMapKey });
  }

  /** 启动当前 Loader 队列并等待完成 */
  private async loadResources(): Promise<void> {
    return new Promise((resolve) => {
      const loader = this.load as unknown as { list: { size?: number; length?: number } };
      const queueSize = loader.list.size ?? loader.list.length ?? 0;
      if (queueSize === 0) {
        resolve();
        return;
      }
      this.load.once("complete", resolve);
      this.load.start();
    });
  }

  /** 从 Tilemap Cache 读取地图原始 JSON 数据 */
  private getMapData(mapKey: string): { tilesets?: Record<string, unknown>[] } | undefined {
    const entry = this.cache.tilemap.get(mapKey) as { data?: { tilesets?: Record<string, unknown>[] } } | undefined;
    return entry?.data;
  }

  /** 收集所有地图 JSON 中外部引用的 tileset */
  private collectExternalTilesets(): ExternalTsx[] {
    const result: ExternalTsx[] = [];
    for (const [mapKey, mapPath] of Object.entries(this.mapsMap)) {
      const mapJson = this.getMapData(mapKey);
      const tilesets = mapJson?.tilesets as { source?: string; firstgid: number }[] | undefined;
      if (!tilesets) continue;
      for (let i = 0; i < tilesets.length; i++) {
        const ts = tilesets[i];
        if (ts.source) {
          const url = this.resolveRelative(mapPath, ts.source);
          result.push({
            mapKey,
            tilesetIndex: i,
            source: ts.source,
            cacheKey: `tsx_${mapKey}_${i}`,
            url,
          });
        }
      }
    }
    return result;
  }

  /** 收集所有已内嵌 tileset 需要预加载的图片（外部 .tsx 由 parseExternalTilesets 处理） */
  private collectEmbeddedTilesetImages(): TilesetImage[] {
    const images: TilesetImage[] = [];
    for (const [mapKey, mapPath] of Object.entries(this.mapsMap)) {
      const mapJson = this.getMapData(mapKey);
      const tilesets = mapJson?.tilesets as { source?: string; image?: string; name?: string }[] | undefined;
      if (!tilesets) continue;
      for (const ts of tilesets) {
        if (ts.source) continue;
        if (ts.image && ts.name) {
          const url = this.resolveRelative(mapPath, ts.image);
          images.push({ key: ts.name, url });
        }
      }
    }
    return images;
  }

  /** 解析 .tsx 文本，内嵌到对应地图 JSON，并返回需要预加载的 tileset 图片 */
  private parseExternalTilesets(externalTsxs: ExternalTsx[]): TilesetImage[] {
    const images: TilesetImage[] = [];
    for (const tsx of externalTsxs) {
      const content = this.cache.text.get(tsx.cacheKey) as string;
      const tileset = TsxParser.parse(content);

      const mapJson = this.getMapData(tsx.mapKey);
      const tilesets = mapJson?.tilesets as Record<string, unknown>[] | undefined;
      if (!tilesets) continue;
      const original = tilesets[tsx.tilesetIndex];
      (tileset as unknown as Record<string, unknown>).firstgid = original.firstgid;

      if (tileset.image) {
        const imageUrl = this.resolveRelative(tsx.url, tileset.image);
        images.push({ key: tileset.name, url: imageUrl });
      }

      // 替换为内嵌 tileset
      tilesets[tsx.tilesetIndex] = tileset as unknown as Record<string, unknown>;
    }
    return images;
  }

  /** 把 relativePath 解析为相对于 public 目录的相对路径（basePath 也是相对于 public） */
  private resolveRelative(basePath: string, relativePath: string): string {
    const baseDir = basePath.split("/").filter((p) => p.length > 0).slice(0, -1);
    const relParts = relativePath.split("/");
    return this.normalizePath([...baseDir, ...relParts]);
  }

  private normalizePath(parts: string[]): string {
    const stack: string[] = [];
    for (const part of parts) {
      if (part === "..") {
        if (stack.length > 0) stack.pop();
      } else if (part !== "." && part !== "") {
        stack.push(part);
      }
    }
    return stack.join("/");
  }

  /** 自动创建动画：仅对 3 行精灵表创建方向性动画（right / down / up） */
  private createAnimations(): void {
    for (const [key, config] of Object.entries(this.animationMap)) {
      const { rows, columns } = config.grid;
      if (rows !== 3) continue;

      const directions = [
        { suffix: "right", start: 0, end: columns - 1 },
        { suffix: "down", start: columns, end: 2 * columns - 1 },
        { suffix: "up", start: 2 * columns, end: 3 * columns - 1 },
      ];

      // 为 default 皮肤创建动画（兼容现有代码，使用原始 key）
      const hasDefault = config.skins.some(
        (s) => s.replace(/\.png$/i, "") === "default",
      );
      if (hasDefault) {
        for (const dir of directions) {
          this.anims.create({
            key: `${key}_${dir.suffix}`,
            frames: this.anims.generateFrameNumbers(key, {
              start: dir.start,
              end: dir.end,
            }),
            frameRate: 10,
            repeat: config.animationStrategy === "loop" ? -1 : 0,
          });
        }
      }

      // 为其他皮肤创建动画
      for (const skin of config.skins) {
        const skinName = skin.replace(/\.png$/i, "");
        if (skinName === "default") continue;

        const textureKey = `${key}_${skinName}`;
        for (const dir of directions) {
          this.anims.create({
            key: `${textureKey}_${dir.suffix}`,
            frames: this.anims.generateFrameNumbers(textureKey, {
              start: dir.start,
              end: dir.end,
            }),
            frameRate: 10,
            repeat: config.animationStrategy === "loop" ? -1 : 0,
          });
        }
      }
    }
  }

  /** 预生成投射物基础纹理（白色圆形，运行时通过 setTint 变色） */
  private createProjectileTexture(): void {
    const projGfx = this.make.graphics({ x: 0, y: 0 }, false);
    projGfx.fillStyle(0xffffff, 1);
    projGfx.fillCircle(8, 8, 8);
    projGfx.generateTexture("projectile_base", 16, 16);
    projGfx.destroy();
  }
}
