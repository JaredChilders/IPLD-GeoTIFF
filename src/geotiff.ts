import { fromUrl, fromFile, fromUrls, fromArrayBuffer, fromBlob } from 'geotiff';
import * as GeoTIFF from 'geotiff';
import fetch from 'cross-fetch';
import { GeoUtils } from './utils/geo-utils'
//import Block from '@ipld/block/defaults';

/**
 * TODO:
 * 1) Convert Uint8Array to Blob.
 * 2) Push Blob to IPFS and get CID from it.
 * 3) Populate Tile Object 
 * 3) Encode Blob with IPLD, turning it into a CID.
 * 3) 
 */

interface Tile {
    cid: string;
    window: number[];
    tileSize: number[];
}

interface GeoTIFFDoc {
    tile: Tile;
    children: Tile[];
}

interface EncodeData {
    data: Blob;
}

function isTiled(image: any): boolean {
    const tileWidth = image.getTileWidth();
    const tileHeight = image.getTileHeight();

    return (tileWidth == tileHeight) ? true : false;
}


function createBlock(){

}

async function createTheTileArray(image: any, n?: number): Promise<any> {
    const origin = 0;

    const xTSize: number = image.getTileHeight();
    const yTSize: number = image.getTileHeight();

    const rows: number = image.getHeight();
    const cols: number = image.getWidth();

    // [left, top, right, bottom] => [0, 0, tile width, tile height]
    // [0, 0, 0, 0]
    const initial_window = [ origin, origin, origin, origin ];
    let current_window = initial_window;

    let numRows: number;
    let numCols: number;

    let right_boundary: number = 0;
    let bottom_boundary: number = 0;

    let dataWindow: Array<any>;

    // i acts as the "top" boundary variable in the window
    for(let i = 0; i < rows; i += yTSize){

        if((i + yTSize) < rows){
            numRows = yTSize;
            bottom_boundary += yTSize;
        }
        else{
            numRows = rows - i;
            bottom_boundary += numRows;
        }

        // j acts as the "left" boundary variable in the window 
        for(let j = 0; j < cols; j += xTSize){

            if((j + xTSize) < cols){
                numCols = xTSize;
                right_boundary += xTSize;
            }
            else{
                numCols = cols - j;
                right_boundary += numCols;
            }

            current_window = [j, i, right_boundary, bottom_boundary];
            console.log("Current Window: " + current_window);
            
            // read the specific block of data from the window
            const tile_data = await image.readRasters({ window: current_window });
            console.log(tile_data)
            // console.log(typeof(tile_data[0]));

            const buffer: Buffer = await GeoUtils.toBuffer(tile_data[0]);
            console.log(buffer);

            // Add Tile
            // const b1 = Block.encoder({ hello: 'world' }, 'dag-cbor')
        }
        // reset the right boundary 
        right_boundary = 0;
    }
}

 /**
  * based on the 
  */
async function run(url: string){
    try{
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await fromArrayBuffer(arrayBuffer);
        //console.log(tiff);
        const imageCount = await tiff.getImageCount();
        //console.log(imageCount);
        const image = await tiff.getImage();
        //console.log(image);

        const samplesPerPixel = image.getSamplesPerPixel();
        console.log(samplesPerPixel)

        const istiled = isTiled(image);

        if(!istiled){
            await createTheTileArray(image);
        }

    }catch(e){
        console.log(e);
    }
}

function main(){
    //console.log(GeoTIFF);
    //let pool = new GeoTIFF.Pool();
    run('http://download.osgeo.org/geotiff/samples/gdal_eg/cea.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/bogota.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/lcc-datum.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/ntf_nord.tif');
}

main();

//run('https://storage.googleapis.com/pdd-stac/disasters/hurricane-harvey/0831/SkySat_Freeport_s03_20170831T162740Z.tif');