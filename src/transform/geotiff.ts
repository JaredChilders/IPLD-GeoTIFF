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

interface Damage{
    [key: string]: Array<any>;
}

async function createTheTileArray(image: any, powergate: Powergate, current_xTSize: number, current_yTSize: number): Promise<Map<any, any>> {

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

    // wrapper Array that we will use to wrap the currentArray
    //let wrapper: GeoTIFFDoc[] = [];

    //let damage: Damage = {};
    let damage = new Map<string, Array<any>>();

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

            damage.set(row_window, current_ArrayA)

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
            
            try{
                const tile_data = await image.readRasters({ window: current_window, pool: pool });
                //const buffer: Buffer = await GeoUtils.toBuffer(tile_data[0]);
                console.log("\n");

                // encode the tile data, then convert to CID
                const cid = await GeoUtils.getCID(tile_data[0]);
                const block = new Block(tile_data[0], cid);
                console.log(block);

                // array of tiles 
                const tile: Tile = {
                    window: `${current_window}`,
                    cid: `${block.cid}`,
                    block: block,
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
            if((endingB == true) && ((counterA % 2) == 0)) current_ArrayA.push(current_ArrayB); 
            else if((endingB == true) && ((counterA % 2) != 0)) current_ArrayA[index] = current_ArrayB;
            
            counterB += 1;
        }

        // Edge case for Rows, needs to push itself
        if(endingA == true){
            const row_window: string = `${start}-${right_boundary - 1}`;
            
            damage.set(row_window, current_ArrayA);
        }

        right_boundary = 0; // reset the right boundary 
        counterB = 0;
        counterA += 1; // increment counter A
    }
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
        window: [],
        bbox: []
    }

    try{
        
        const powergate = await Powergate.build();
        ires.token = await powergate.getToken();

        const max_Height: number = image.getHeight();
        const max_Width: number = image.getWidth();

        const istiled = isTiled(image);

        let masterDoc2 = new Map<string, GeoTIFFDoc[]>();
        let masterDoc = new Map<string, Map<any,any>>();

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

                if((current_yTSize < max_Height) && (current_xTSize < max_Width)){
                    let gt_doc: Map<any,any> = await createTheTileArray(image, powergate, current_xTSize, current_yTSize);
                    masterDoc.set(`${current_yTSize}` + 'x' + `${current_xTSize}`, gt_doc)
                }
                else{
                    // end tiling and get whole image then end while loop
                    let gt_doc: Map<any,any> = await createTheTileArray(image, powergate, max_Width, max_Height);
                    masterDoc.set(`${max_Height}` + 'x' + `${max_Width}`, gt_doc)
                    cont = false;
                }
                n += 1;
                console.log(" NEW SCALE \n")
            }

            const stringdoc = JSON.stringify(masterDoc);
            const bytes = new TextEncoder().encode(stringdoc);
            //const buffer: Buffer = await GeoUtils.toBuffer(uint8array);

            //
            //const _cid = await powergate.getAssetCid(buffer);

            const _cid = await GeoUtils.getCID(bytes);
            const block = new Block(bytes, _cid);
            console.log(block);

            ires.cid = block.cid;

            await powergate.pin(block.cid);

            spinner.clear();
            spinner.succeed('Tiling was Successful');
            
            console.log(masterDoc);
        }
    }catch(e){
        spinner.clear()
        spinner.fail(e.toString());
        throw e;
    }

    return ires;
}

async  function getGeoTIFF(_cid: string, _token: string, _window: Array<number>, _bbox: Array<number>, _targetArea: Array<any>, ): Promise<any>{
    let masterDoc = new Map<string, GeoTIFFDoc[]>(); 
    
    try{
        const powergate = await Powergate.build(_token);
        const bytes = await powergate.getGeoDIDDocument(_cid);
        const strj = new TextDecoder('utf-8').decode(bytes);
        if(typeof(strj) == 'string') masterDoc = JSON.parse(strj)
        else throw new Error('Error')

        const targetWindow: ImageMetadata = await GeoUtils.bboxtoWindow(_window, _bbox, _targetArea);

        const target_Width = targetWindow.o_window[2] - targetWindow.o_window[0];
        const target_Height = targetWindow.o_window[3] - targetWindow.o_window[1];

        masterDoc.forEach((value: any, key: string)=> {
            const wxh = key.split('x');
            const width = parseInt(wxh[0], 10);
            const height = parseInt(wxh[2], 10);

            if(target_Height <= height){
                
                for(let i = 0; i < value.length(); i++){
                    const wop = value[i].row_window.split('-');
                    const height_top = parseInt(wop[1], 10);
                    const height_bot = parseInt(wop[3], 10);

                    if((targetWindow.i_window[1] >= height_top) || (targetWindow.i_window[3] <= height_bot)){
                        console.log(value[i].children)
                    }
                    else {
                        console.log(value[i].children)
                    }
                }
            }

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

        //await getGeoTIFF(ires.cid, ires.token, ires.window, ires.bbox, request);
    }catch(err){
        console.log(err)
    }


    //run('http://download.osgeo.org/geotiff/samples/gdal_eg/cea.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/bogota.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/lcc-datum.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/ntf_nord.tif');
}

main();