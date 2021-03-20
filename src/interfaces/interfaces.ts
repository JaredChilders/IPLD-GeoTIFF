export interface IWrapper{
    [key: string]: any;
}

export interface IWrappedWrapper{
    [key: string]: any;
}

export interface MasterWrapper{
    [key:string]: any;
}

export interface ITransport{
    cid: any
    boundingRow: Array<number>
    wrapper: IWrapper
}

export interface TileSize {
    width: number;
    height: number;
}

export interface Tile {
    cid?: any;
    data: any;
    window: Array<number>;
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
    max_Dimensions: Array<number>;
    window: Array<number>;
    bbox: Array<number>;
}

