import CID from 'cids';

export interface IWrapper{
    [key: string]: any;
}

export interface IWrappedWrapper{
    [key: string]: CID;
}

export interface MasterWrapper{
    [key:string]: any;
}

export interface Resolution{
    value: any;
    remainderPath: string;
}

export interface BlockData{
    cid: CID;
    data: any;
    pathList: Array<string>;
}

export interface ITransport{
    cid: CID;
    boundingRow: Array<number>;
    wrapper: IWrapper;
}

export interface TileSize {
    height: number;
    width: number;
}

export interface Tile {
    cid?: CID;
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
    cid?: CID;
    max_Dimensions: Array<number>;
    window: Array<number>;
    bbox: Array<number>;
}

