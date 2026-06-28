const fs = require('fs');
const path = require('path');

const mapPath = process.argv[2] || 'public/maps/forest/forest.json';
const mapDir = path.dirname(path.resolve(mapPath));
const mapJson = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

function parseAttrs(tag) {
    const attrs = {};
    const regex = /(\w+)="([^"]*)"/g;
    let m;
    while ((m = regex.exec(tag)) !== null) {
        attrs[m[1]] = m[2];
    }
    return attrs;
}

function parseProperties(content) {
    const props = [];
    const propRegex = /<property\s+name="([^"]*)"\s+type="([^"]*)"\s+value="([^"]*)"\/>/g;
    let m;
    while ((m = propRegex.exec(content)) !== null) {
        let value = m[3];
        if (m[2] === 'bool') value = value === 'true';
        else if (m[2] === 'int') value = parseInt(value, 10);
        else if (m[2] === 'float') value = parseFloat(value);
        props.push({ name: m[1], type: m[2], value });
    }
    return props;
}

function parseAnimation(content) {
    const animMatch = content.match(/<animation>([\s\S]*?)<\/animation>/);
    if (!animMatch) return null;
    const frames = [];
    const frameRegex = /<frame\s+tileid="(\d+)"\s+duration="(\d+)"\/>/g;
    let m;
    while ((m = frameRegex.exec(animMatch[1])) !== null) {
        frames.push({ tileid: parseInt(m[1], 10), duration: parseInt(m[2], 10) });
    }
    return frames;
}

function parseObjectgroup(content) {
    const ogMatch = content.match(/<objectgroup([^>]*)>([\s\S]*?)<\/objectgroup>/);
    if (!ogMatch) return null;
    const objects = [];
    const objRegex = /<object\s+id="(\d+)"\s+x="([^"]*)"\s+y="([^"]*)"(?:\s+width="([^"]*)")?(?:\s+height="([^"]*)")?\/>/g;
    let m;
    while ((m = objRegex.exec(ogMatch[2])) !== null) {
        const obj = {
            id: parseInt(m[1], 10),
            x: parseFloat(m[2]),
            y: parseFloat(m[3]),
        };
        if (m[4]) obj.width = parseFloat(m[4]);
        if (m[5]) obj.height = parseFloat(m[5]);
        objects.push(obj);
    }
    return { draworder: 'index', objects };
}

function parseTsx(tsxPath) {
    const content = fs.readFileSync(tsxPath, 'utf8');
    const tsxDir = path.dirname(tsxPath);

    const tilesetMatch = content.match(/<tileset[^>]*>/);
    if (!tilesetMatch) throw new Error(`Cannot parse tileset in ${tsxPath}`);
    const tilesetAttrs = parseAttrs(tilesetMatch[0]);

    const tileset = {
        columns: parseInt(tilesetAttrs.columns, 10),
        name: tilesetAttrs.name,
        tilewidth: parseInt(tilesetAttrs.tilewidth, 10),
        tileheight: parseInt(tilesetAttrs.tileheight, 10),
        tilecount: parseInt(tilesetAttrs.tilecount, 10),
    };

    if (tilesetAttrs.spacing !== undefined) tileset.spacing = parseInt(tilesetAttrs.spacing, 10);
    if (tilesetAttrs.margin !== undefined) tileset.margin = parseInt(tilesetAttrs.margin, 10);

    const imageMatch = content.match(/<image([^>]*)\/>/);
    if (imageMatch) {
        const imageAttrs = parseAttrs(`<image${imageMatch[1]}>`);
        const imageSource = path.resolve(tsxDir, imageAttrs.source);
        tileset.image = path.relative(mapDir, imageSource).replace(/\\/g, '/');
        tileset.imagewidth = parseInt(imageAttrs.width, 10);
        tileset.imageheight = parseInt(imageAttrs.height, 10);
    }

    const tiles = [];
    const tileRegex = /<tile\s+id="(\d+)"([^>]*)>([\s\S]*?)<\/tile>/g;
    let match;
    while ((match = tileRegex.exec(content)) !== null) {
        const tileId = parseInt(match[1], 10);
        const tileContent = match[3];
        const tile = { id: tileId };

        const tileAttrs = parseAttrs(`<tile${match[2]}>`);
        if (tileAttrs.type) tile.type = tileAttrs.type;

        const props = parseProperties(tileContent);
        if (props.length > 0) tile.properties = props;

        const animation = parseAnimation(tileContent);
        if (animation) tile.animation = animation;

        const objectgroup = parseObjectgroup(tileContent);
        if (objectgroup) tile.objectgroup = objectgroup;

        tiles.push(tile);
    }

    if (tiles.length > 0) tileset.tiles = tiles;

    return tileset;
}

async function main() {
    for (const ts of mapJson.tilesets) {
        if (ts.source) {
            const tsxPath = path.resolve(mapDir, ts.source);
            console.log(`Embedding ${path.relative(process.cwd(), tsxPath)}...`);
            const tileset = parseTsx(tsxPath);
            tileset.firstgid = ts.firstgid;
            Object.keys(ts).forEach(k => delete ts[k]);
            Object.assign(ts, tileset);
        }
    }
    fs.writeFileSync(mapPath, JSON.stringify(mapJson, null, 1), 'utf8');
    console.log(`Done: ${mapPath}`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
