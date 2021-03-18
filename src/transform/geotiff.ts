import { fromUrl, fromFile, fromUrls, fromArrayBuffer, fromBlob } from 'geotiff';
import * as GeoTIFF from 'geotiff';
import fetch from 'cross-fetch';
import { GeoUtils } from '../utils/geo-utils'
import { Powergate } from '../pin/powergate'
import Block from 'ipld-block'
import { Tile, GeoTIFFDoc, IResponse, ImageMetadata } from '../interfaces/interfaces'

const ora = require('ora');
const cliSpinners = require('cli-spinners');

const spinner = new ora({
    discardStdin: false,
    text: 'Tiling Image and Loading Overviews',
    spinner: cliSpinners.dots
});

function isTiled(image: any): boolean {
    const tileWidth = image.getTileWidth();
    const tileHeight = image.getTileHeight();

    return (tileWidth == tileHeight) ? true : false;
}

interface IWrapper{
    [key: string]: Array<any>;
}

interface IWrappedWrapper{
    [key: string]: IWrapper;
}

function getMinMax(minMax: Array<number>, current_window: Array<number>){
    let i: number = 0;
    return minMax.forEach((element: any) => {
        if((i==0) && ((current_window[i] < minMax[i]))) minMax[0] = current_window[i];
        else if((i==1) && (current_window[i] < minMax[i])) minMax[1] = current_window[i];
        else if((i==2) && (current_window[i] > minMax[i])) minMax[2] = current_window[i];
        else if((i==3) && (current_window[i] > minMax[i])) minMax[3] = current_window[i];
        i++;
    });
}

async function createTheTileArray(image: any, powergate: Powergate, current_xTSize: number, current_yTSize: number): Promise<IWrapper> {

    let pool = new GeoTIFF.Pool();
    
    const rows: number = image.getHeight();
    const cols: number = image.getWidth();

    // window -> [left, top, right, bottom] 
    const initial_window = [ 0, 0, 0, 0 ];
    let current_window = initial_window;

    let numRows: number = 0;
    let numCols: number = 0;

    let right_boundary: number = 0;
    let bottom_boundary: number = 0;

    let counterA: number = 0;
    let counterB: number = 0;

    let start: number = 0;

    let damage: IWrapper = {}

    // declare current_ArrayA
    let current_ArrayA : Array<Array<Tile>>;

    // declare current_ArrayB
    let current_ArrayB: Array<Tile>;

    let index: number = 0;
    let info: number = 0;

    let endingA: boolean = false; 
    //spinner.start();
    
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

        // AAA Genesis
        if(counterA == 0){
            // initialize 2D array of Tile Interface
            current_ArrayA = new Array<Array<Tile>>();

            start = i;
        }
        else if(counterA % 2 == 0){

            const row_window: string = `${start}-${i - 1}`;

            damage[row_window] = current_ArrayA;

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

            current_window = [j, i, right_boundary, bottom_boundary];

            // second passthrough
            if((counterA % 2) != 0){
                info = current_ArrayA.length;
 
                if(((counterB % 2) == 0) && (counterB != 0)) index += 1;
                
                if(index < info) current_ArrayB = current_ArrayA[index];
            } 
            // first passthrough 
            else{
                if(counterB == 0){
                    // first run of first passthrough 
                    current_ArrayB = new Array<Tile>();
                }
                else if(((counterB % 2) == 0)){
                    current_ArrayA.push(current_ArrayB); // pushes the previous duo
                    current_ArrayB = new Array<Tile>();
                }
            }
            
            try{
                const tile_data = await image.readRasters({ window: current_window, pool: pool });
                //const buffer: Buffer = await GeoUtils.toBuffer(tile_data[0]);
                //console.log("\n");

                // encode the tile data, then convert to CID
                const cid = await GeoUtils.getCID(tile_data[0]);

                // not really needed tbh but you will need block later to encapsulate the data
                const block = new Block(tile_data[0], cid);
                //console.log(block);

                // array of tiles 
                const tile: Tile = {
                    window: `${current_window}`,
                    cid: block.cid,
                    tileSize: {
                        width: tile_data.width,
                        height: tile_data.height
                    }
                }

                current_ArrayB.push(tile); 

            }catch(e){
                spinner.clear();
                spinner.fail(e.toString());
                throw(e);
            }
            
            // Edge case for Cols, needs to push itself for two scenarios
            if((endingB == true) && ((counterA % 2) == 0)){
                current_ArrayA.push(current_ArrayB); 
            }
            else if((endingB == true) && ((counterA % 2) != 0)){
                current_ArrayA[index] = current_ArrayB;
            }
            counterB += 1;
        }

        // Edge case for Rows, needs to push itself
        if(endingA == true){
            const row_window: string = `${start}-${right_boundary - 1}`;
            //onsole.log(current_ArrayA)
            damage[row_window] = current_ArrayA;
        }

        right_boundary = 0; // reset the right boundary 
        counterB = 0;
        counterA += 1; // increment counter A
    }

    //console.log(damage)

    return damage;
}

async function getImageFromUrl(url: string): Promise<any>{
    try{
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();

        return image;
    }
    catch(e){
        throw e;
    }
}

 /**
  * based on the 
  */
async function startTile(image: any): Promise<IResponse>{

    let ires: IResponse = {
        cid: '',
        token: '',
        max_Dimensions: [],
        window: [],
        bbox: []
    }

    let masterDoc: IWrappedWrapper = {}

    try{
        
        const powergate = await Powergate.build();
        ires.token = await powergate.getToken();

        const max_Height: number = image.getHeight();
        const max_Width: number = image.getWidth();

        const istiled = isTiled(image);

        let cont = true;

        // window = [ left , top , right , bottom ]
        ires.window = [0, 0, max_Width, max_Height];

        // bbox = [ min Longitude , min Latitude , max Longitude , max Latitude ]
        ires.bbox = image.getBoundingBox();

        if(!istiled){

            // First iteration it is 0
            let n: number = 0;

            while(cont){

                const current_scale = Math.pow(2, n);

                const current_xTSize = image.getTileHeight() * current_scale;
                const current_yTSize = image.getTileHeight() * current_scale;

                ires.max_Dimensions.push(current_xTSize);

                if((current_yTSize < max_Height) && (current_xTSize < max_Width)){
                    let block: IWrapper = await createTheTileArray(image, powergate, current_xTSize, current_yTSize);
                    masterDoc[`${current_yTSize}` + 'x' + `${current_xTSize}`] = block;
                }
                else{
                    // end tiling and get whole image then end while loop
                    let block: IWrapper = await createTheTileArray(image, powergate, max_Width, max_Height);
                    masterDoc[`${max_Height}` + 'x' + `${max_Width}`] = block;
                    cont = false;
                }
                n += 1;
                //console.log(" NEW SCALE \n")
            }

            const stringdoc = JSON.stringify(masterDoc);

            const bytes = new TextEncoder().encode(stringdoc);

            const _cid = await powergate.getAssetCid(bytes);

            ires.cid = _cid;

            await powergate.pin(_cid);

            spinner.clear();
            spinner.succeed('Tiling was Successful');
            
        }
    }catch(e){
        spinner.clear()
        spinner.fail(e.toString());
        throw e;
    }

    return ires;
}

async  function getGeoTIFF(_cid: string, _token: string, _targetWindow: ImageMetadata): Promise<any>{
    let masterDoc = new Map<string, GeoTIFFDoc[]>(); 
    
    try{
        const powergate = await Powergate.build(_token);
        const bytes = await powergate.getGeoDIDDocument(_cid);
        const strj = new TextDecoder('utf-8').decode(bytes);
        if(typeof(strj) == 'string') masterDoc = JSON.parse(strj); 
        else throw new Error('Error')

        console.log(masterDoc);

        const target_Width = _targetWindow.o_window[2] - _targetWindow.o_window[0]; 
        const target_Height = _targetWindow.o_window[3] - _targetWindow.o_window[1]; 

        masterDoc.forEach((value: any, key: string)=> {
            const wxh = key.split('x');
            const width = parseInt(wxh[0], 10);
            const height = parseInt(wxh[2], 10);

            if( (target_Height <= height) && (target_Width <= width) ){
                //create selector to grab data
                const mr = key.split('-');
                const min_row = parseInt(mr[0], 10);
                const max_row = parseInt(mr[2], 10);

                if((_targetWindow.o_window[1] >= min_row) && (_targetWindow.o_window[3] <= max_row)){
                    //for(let i = 0; i < value.`$`)
                }
                else throw new Error("Does not have compatible row");
            }
            else throw new Error("Not Valid Size");
        })

    }catch(err){
        throw err; 
    }

    return "yo";
}

async function main(){
    //let pool = new GeoTIFF.Pool();
    const url = 'http://download.osgeo.org/geotiff/samples/gdal_eg/cea.tif';

    const request = [
        -28493.166784412522,
        4224973.143255847,
        2358.211624949061,
        4255884.5438021915
    ];

    try{
        const image = await getImageFromUrl(url)
        const ires: IResponse =  await startTile(image);

        console.log(ires);

        const targetWindow: ImageMetadata = await GeoUtils.bboxtoWindow(ires.window, ires.bbox, request, ires.max_Dimensions);

        const yo = await getGeoTIFF(ires.cid, ires.token, targetWindow);
    }catch(err){
        console.log(err)
    }


    //run('http://download.osgeo.org/geotiff/samples/gdal_eg/cea.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/bogota.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/lcc-datum.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/ntf_nord.tif');
}

main();