export interface TileSize {
    width: number;
    height: number;
}

export interface Tile {
    cid?: string;
    window: string;
    block: any;
    tileSize: TileSize;
}

export interface GeoTIFFDoc {
    row_window: string;
    children: Tile[][];
}

export interface GeoTIFFDocument {
    [key: string]: Tile[][]
}

export interface ImageMetadata{
    o_window: Array<number>;
    i_window: Array<number>;
    o_bbox: Array<number>;
    i_bbox: Array<number>;
}

export interface IResponse {
    cid: string;
    token: string;
    window: Array<number>;
    bbox: Array<number>;
}