import { fromUrl, fromFile, fromUrls, fromArrayBuffer, fromBlob } from 'geotiff';
import * as GeoTIFF from 'geotiff';
import fetch from 'cross-fetch';
import { GeoUtils } from './utils/geo-utils'
import { Powergate } from './powergate'
//import Block from '@ipld/block/defaults';

/**
 * TODO:
 * 1) Convert Uint8Array to Blob.
 * 2) Push Blob to IPFS and get CID from it.
 * 3) Populate Tile Object 
 * 3) Encode Blob with IPLD, turning it into a CID.
 * 3) 
 */

interface TileSize {
    width: number;
    height: number;
}

interface Tile {
    cid?: string;
    window: string;
    tileSize: TileSize;
}

interface GeoTIFFDoc {
    row_window: any;
    children: Tile[][];
}

interface EncodeData {
    data: Blob;
}

function isTiled(image: any): boolean {
    const tileWidth = image.getTileWidth();
    const tileHeight = image.getTileHeight();

    return (tileWidth == tileHeight) ? true : false;
}



async function createTheTileArray(image: any, n = 0): Promise<any> {

    //const powergate = await Powergate.build();
    
    // get token 

    const origin = 0;

    const rows: number = image.getHeight();
    const cols: number = image.getWidth();

    // First iteration it is 0
    const current_scale = Math.pow(2, n);
    const next_scale = Math.pow(2, n + 1);

    // TODO: Fix later
    const current_xTSize = image.getTileHeight() * current_scale;
    const current_yTSize = image.getTileHeight() * current_scale;

    // Calculates the next scale level size of the parent tile
    const next_xTSize = current_xTSize * next_scale;
    const next_yTSize = current_yTSize * next_scale;
    //console.log(next_xTSize);
    //console.log(next_yTSize);

    // [left, top, right, bottom] => [0, 0, tile width, tile height]
    // [0, 0, 0, 0]
    const initial_window = [ origin, origin, origin, origin ];
    let current_window = initial_window;

    let numRows: number;
    let numCols: number;

    let right_boundary: number = 0;
    let bottom_boundary: number = 0;

    let counterA = 0;
    let counterB = 0;

    let start: number = 0;

    // wrapper Array that we will use to wrap the currentArray
    let wrapper: GeoTIFFDoc[] = [];

    // declare current_ArrayA
    let current_ArrayA : Array<Array<Tile>>;

    // declare current_ArrayB
    let current_ArrayB: Array<Tile>;

    let index: number = 0;
    let info: number = 0;

    let endingA: boolean = false;
    
    // i acts as the "top" boundary variable in the window
    for(let i = 0; i < rows; i += current_yTSize){

        if((i + current_yTSize) < rows){
            numRows = current_yTSize;
            bottom_boundary += current_yTSize;
            endingA = false;
        }
        else{
            numRows = rows - i;
            bottom_boundary += numRows
            endingA = true;
        }

        // Genesis
        if(counterA == 0){
            // initialize 2D array of Tile Interface
            current_ArrayA = new Array<Array<Tile>>();
            start = i;
        }
        else if(counterA % 2 == 0){
            const geotiffdoc: GeoTIFFDoc = {
                row_window: `${start} - ${i}`,
                children: current_ArrayA
            }
            // push to the Wrapper Array (3D)
            wrapper.push(geotiffdoc);

            // refresh the indexes
            start = i;
            index = 0;
            // initialize a new Array for the next 2 Rows
            current_ArrayA = new Array<Array<Tile>>();
        }

        let endingB: boolean = false;

        // j acts as the "left" boundary variable in the window 
        for(let j = 0; j < cols; j += current_xTSize){

            if(((j + current_xTSize) < cols)){
                numCols = current_xTSize;
                right_boundary += current_xTSize;
                endingB = false;
            }
            else{
                numCols = cols - j;
                right_boundary += numCols;
                endingB = true;
            }

            if((counterA % 2) != 0){
                info = current_ArrayA.length;
 
                if(((counterB % 2) == 0) && (counterB != 0)) index += 1;
                
                if(index < info) current_ArrayB = current_ArrayA[index];
            } 
            else{
                if(counterB == 0){
                    current_ArrayB = new Array<Tile>();
                }
                else if(((counterB % 2) == 0)){
                    current_ArrayA.push(current_ArrayB); // pushes the previous duo
                    current_ArrayB = new Array<Tile>();
                }
            }

            current_window = [j, i, right_boundary, bottom_boundary];
            //console.log("Current Window: " + current_window);
            
            try{
                // read the specific block of data from the window
                const tile_data = await image.readRasters({ window: current_window });
                //console.log(tile_data)

                //const buffer: Buffer = await GeoUtils.toBuffer(tile_data[0]);
                //console.log(buffer);

                //const cid = await powergate.getAssetCid(buffer);

                //await powergate.pin(cid);

                // array of tiles 
                
                const tile: Tile = {
                    window: `${current_window}`,
                    tileSize: {
                        width: tile_data.width,
                        height: tile_data.height
                    }
                }

                // push the tiles to the tile Array
                current_ArrayB.push(tile);

            }catch(e){
                console.log(e);
            }
            
            // Edge case for Cols, needs to push itself for two scenarios
            if((endingB == true) && ((counterA % 2) == 0)){
                current_ArrayA.push(current_ArrayB); // bug
            }
            else if((endingB == true) && ((counterA % 2) != 0)){
                current_ArrayA[index] = current_ArrayB;
            }

            counterB += 1;
        }

        // Edge case for Rows, needs to push itself
        if(endingA == true){
            const geotiffdoc: GeoTIFFDoc = {
                row_window: `${start} - ${right_boundary}`,
                children: current_ArrayA
            }
            // push to the Wrapper Array (3D)
            wrapper.push(geotiffdoc);
        }

        right_boundary = 0; // reset the right boundary 
        counterB = 0;
        counterA += 1; // increment counter A 

        //if((counterA % 2 == 0) && (counterA != 0)) console.log(current_ArrayA.length);
        //if((counterA % 2 == 0) && (counterA != 0)) console.log(current_ArrayA);

       //console.log(current_ArrayA);
    }

    // print the final wrapped Document
    console.log(wrapper);
    console.log(wrapper.length);
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
        //console.log(samplesPerPixel);

        const istiled = isTiled(image);

        // window = [ left , top , right , bottom ]
        // bbox = [ min Longitude , min Latitude , max Longitude , max Latitude ]
        //const bbox = image.getBoundingBox();
        //console.log(bbox);

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