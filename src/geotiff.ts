import { fromUrl, fromFile, fromUrls, fromArrayBuffer, fromBlob } from 'geotiff';
import * as GeoTIFF from 'geotiff';
import fetch from 'cross-fetch';

function isTiled(image: any): boolean {
    const tileWidth = image.getTileWidth();
    const tileHeight = image.getTileHeight();

    return (tileWidth == tileHeight) ? true : false;
}

interface ITile{
    xPixels: number;
    yPixels: number;
}

async function createTheTileArray(image: any, n?: number): Promise<any> {
    const origin = 0;

    const { xTSize, yTSize } = image.getTileHeight();

    const rows = image.getHeight();
    const cols = image.getWidth();

    // [left, top, right, bottom] => [0, 0, tile width, tile height]
    // [0, 0, 0, 0]
    const initial_window = [ origin, origin, origin, origin ];
    let current_window = initial_window;

    let numRows: number;
    let numCols: number;

    let dataWindow: Array<any>;

    for(let i = 0; i < rows; i += yTSize){

        if((i + yTSize) < rows)
            numRows = yTSize;
        else
            numRows = rows - i;

        for(let j = 0; j < cols; j += xTSize){

            if((j + xTSize) < cols)
                numCols = xTSize;
            else
                numCols = cols - j;

            current_window = [j, i, numCols, numRows];
            
            // read the specific block of data from the window
            const tile_data = await image.readRasters({ window: current_window });

        }
    }

    return 
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

        const istiled = isTiled(image);

        if(!istiled){
            const tilingMetadata = prepImageForTiling(image);
        }
        //const data = await image.readRasters({ pool });
        //console.log(data);

       
        

        // 128 x 128 px 
        //const tileSize = [128, 128];

        // [left, top, right, bottom]
        const row1tile1 = [0, 0, 128, 128];
        const row1tile2 = [128, 0, 256, 128];
        const row1tile3 = [256, 0, 384, 128];
        const row1tile4 = [384, 0, 512, 128];

        const row1 = [row1tile1, row1tile2, row1tile3, row1tile4];

        for(const row of row1) {
            //console.log(row);
            const tiledata = await image.readRasters({ window: row1tile1 });
            console.log(typeof(tiledata));
        }

        //const tile1data = await image.readRasters({ window: row1tile1 });

        //const tile2data = await image.readRasters({ window: row1tile2 });

        // tile the data array into fourths
        //chuckIntoTiles(data);

        /* const resolution = image.getResolution();
        console.log(resolution)

        const boundingBox = image.getBoundingBox();
        console.log(boundingBox);

        const width = image.getWidth();
        const height = image.getHeight();
        console.log("Width " + width); // 514
        console.log("Height " + height); // 515

        const tileWidth = image.getTileWidth();
        const tileHeight = image.getTileHeight();
        console.log("Tile Width " + tileWidth) //514
        console.log("Tile Height " + tileHeight) //15

        console.log('\n');
        console.log('\n'); */

    }catch(e){
        console.log(e);
    }
}

function main(){
    //console.log(GeoTIFF);
    //let pool = new GeoTIFF.Pool();
    run('http://download.osgeo.org/geotiff/samples/gdal_eg/cea.tif');
    run('https://download.osgeo.org/geotiff/samples/made_up/bogota.tif');
    run('https://download.osgeo.org/geotiff/samples/made_up/lcc-datum.tif');
    run('https://download.osgeo.org/geotiff/samples/made_up/ntf_nord.tif');
}

main();

//run('https://storage.googleapis.com/pdd-stac/disasters/hurricane-harvey/0831/SkySat_Freeport_s03_20170831T162740Z.tif');