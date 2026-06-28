export interface TsxTilesetData {
    columns: number;
    name: string;
    tilewidth: number;
    tileheight: number;
    tilecount: number;
    spacing?: number;
    margin?: number;
    image?: string;
    imagewidth?: number;
    imageheight?: number;
    tiles?: TsxTileData[];
}

export interface TsxTileData {
    id: number;
    type?: string;
    properties?: TsxProperty[];
    animation?: TsxAnimationFrame[];
    objectgroup?: TsxObjectGroup;
}

export interface TsxProperty {
    name: string;
    type: string;
    value: string | number | boolean;
}

export interface TsxAnimationFrame {
    tileid: number;
    duration: number;
}

export interface TsxObjectGroup {
    draworder: string;
    objects: TsxObject[];
}

export interface TsxObject {
    id: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
}

/** 把 Tiled XML 格式的 .tsx 解析为内嵌 tileset JSON 数据 */
export class TsxParser {
    static parse(content: string): TsxTilesetData {
        const tilesetMatch = content.match(/<tileset[^>]*>/);
        if (!tilesetMatch) {
            throw new Error('[TsxParser] 无法解析 tileset 标签');
        }
        const tilesetAttrs = this.parseAttrs(tilesetMatch[0]);

        const tileset: TsxTilesetData = {
            columns: parseInt(tilesetAttrs.columns, 10),
            name: tilesetAttrs.name,
            tilewidth: parseInt(tilesetAttrs.tilewidth, 10),
            tileheight: parseInt(tilesetAttrs.tileheight, 10),
            tilecount: parseInt(tilesetAttrs.tilecount, 10),
        };

        if (tilesetAttrs.spacing !== undefined) {
            tileset.spacing = parseInt(tilesetAttrs.spacing, 10);
        }
        if (tilesetAttrs.margin !== undefined) {
            tileset.margin = parseInt(tilesetAttrs.margin, 10);
        }

        const imageMatch = content.match(/<image([^>]*)\/>/);
        if (imageMatch) {
            const imageAttrs = this.parseAttrs(`<image${imageMatch[1]}>`);
            tileset.image = imageAttrs.source;
            tileset.imagewidth = parseInt(imageAttrs.width, 10);
            tileset.imageheight = parseInt(imageAttrs.height, 10);
        }

        const tiles: TsxTileData[] = [];
        const tileRegex = /<tile\s+id="(\d+)"([^>]*)>([\s\S]*?)<\/tile>/g;
        let match: RegExpExecArray | null;
        while ((match = tileRegex.exec(content)) !== null) {
            const tileId = parseInt(match[1], 10);
            const tileContent = match[3];
            const tile: TsxTileData = { id: tileId };

            const tileAttrs = this.parseAttrs(`<tile${match[2]}>`);
            if (tileAttrs.type) {
                tile.type = tileAttrs.type;
            }

            const props = this.parseProperties(tileContent);
            if (props.length > 0) {
                tile.properties = props;
            }

            const animation = this.parseAnimation(tileContent);
            if (animation) {
                tile.animation = animation;
            }

            const objectgroup = this.parseObjectgroup(tileContent);
            if (objectgroup) {
                tile.objectgroup = objectgroup;
            }

            tiles.push(tile);
        }

        if (tiles.length > 0) {
            tileset.tiles = tiles;
        }

        return tileset;
    }

    private static parseAttrs(tag: string): Record<string, string> {
        const attrs: Record<string, string> = {};
        const regex = /(\w+)="([^"]*)"/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(tag)) !== null) {
            attrs[m[1]] = m[2];
        }
        return attrs;
    }

    private static parseProperties(content: string): TsxProperty[] {
        const props: TsxProperty[] = [];
        const propRegex = /<property\s+name="([^"]*)"\s+type="([^"]*)"\s+value="([^"]*)"\/>/g;
        let m: RegExpExecArray | null;
        while ((m = propRegex.exec(content)) !== null) {
            let value: string | number | boolean = m[3];
            if (m[2] === 'bool') {
                value = value === 'true';
            } else if (m[2] === 'int') {
                value = parseInt(value, 10);
            } else if (m[2] === 'float') {
                value = parseFloat(value);
            }
            props.push({ name: m[1], type: m[2], value });
        }
        return props;
    }

    private static parseAnimation(content: string): TsxAnimationFrame[] | null {
        const animMatch = content.match(/<animation>([\s\S]*?)<\/animation>/);
        if (!animMatch) {
            return null;
        }
        const frames: TsxAnimationFrame[] = [];
        const frameRegex = /<frame\s+tileid="(\d+)"\s+duration="(\d+)"\/>/g;
        let m: RegExpExecArray | null;
        while ((m = frameRegex.exec(animMatch[1])) !== null) {
            frames.push({
                tileid: parseInt(m[1], 10),
                duration: parseInt(m[2], 10),
            });
        }
        return frames;
    }

    private static parseObjectgroup(content: string): TsxObjectGroup | null {
        const ogMatch = content.match(/<objectgroup([^>]*)>([\s\S]*?)<\/objectgroup>/);
        if (!ogMatch) {
            return null;
        }
        const objects: TsxObject[] = [];
        const objRegex = /<object\s+id="(\d+)"\s+x="([^"]*)"\s+y="([^"]*)"(?:\s+width="([^"]*)")?(?:\s+height="([^"]*)")?\/>/g;
        let m: RegExpExecArray | null;
        while ((m = objRegex.exec(ogMatch[2])) !== null) {
            const obj: TsxObject = {
                id: parseInt(m[1], 10),
                x: parseFloat(m[2]),
                y: parseFloat(m[3]),
            };
            if (m[4]) {
                obj.width = parseFloat(m[4]);
            }
            if (m[5]) {
                obj.height = parseFloat(m[5]);
            }
            objects.push(obj);
        }
        return { draworder: 'index', objects };
    }
}
