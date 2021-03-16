import { fromUrl, fromFile, fromUrls, fromArrayBuffer, fromBlob } from 'geotiff';
import fetch from 'cross-fetch';
import { GeoUtils } from '../utils/geo-utils'
import { Powergate } from '../pin/powergate'
import { Tile, MasterDocument, GeoTIFFDoc, IResponse } from '../interfaces/interfaces'

function isTiled(image: any): boolean {
    const tileWidth = image.getTileWidth();
    const tileHeight = image.getTileHeight();

    return (tileWidth == tileHeight) ? true : false;
}

async function createTheTileArray(image: any, powergate: Powergate, current_xTSize: number, current_yTSize: number): Promise<GeoTIFFDoc[]> {

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


        // AAA Genesis
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
            
            try{
                const tile_data = await image.readRasters({ window: current_window });
                const buffer: Buffer = await GeoUtils.toBuffer(tile_data[0]);
                const cid = await powergate.getAssetCid(buffer);

                await powergate.pin(cid);

                // array of tiles 
                const tile: Tile = {
                    window: `${current_window}`,
                    tileSize: {
                        width: tile_data.width,
                        height: tile_data.height
                    }
                }

                current_ArrayB.push(tile);
            }catch(e){
                throw(e);
            }
            
            // Edge case for Cols, needs to push itself for two scenarios
            if((endingB == true) && ((counterA % 2) == 0)) current_ArrayA.push(current_ArrayB); 
            else if((endingB == true) && ((counterA % 2) != 0)) current_ArrayA[index] = current_ArrayB;
            
            counterB += 1;
        }

        // Edge case for Rows, needs to push itself
        if(endingA == true){
            const geotiffdoc: GeoTIFFDoc = {
                row_window: `${start} - ${right_boundary}`,
                children: current_ArrayA
            }
            wrapper.push(geotiffdoc);
        }

        right_boundary = 0; // reset the right boundary 
        counterB = 0;
        counterA += 1; // increment counter A
    }
    return wrapper;
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

        let masterDoc: MasterDocument = {};

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
                    let gt_doc: GeoTIFFDoc[] = await createTheTileArray(image, powergate, current_xTSize, current_yTSize);
                    masterDoc[`${current_yTSize}` + 'x' + `${current_xTSize}`] = gt_doc;
                }
                else{
                    // end tiling and get whole image then end while loop
                    let gt_doc: GeoTIFFDoc[] = await createTheTileArray(image, powergate, max_Width, max_Height);
                    masterDoc[`${max_Height}` + 'x' + `${max_Width}`] = gt_doc;
                    cont = false;
                }
                n += 1;
            }

            const stringdoc = JSON.stringify(masterDoc);
            const uint8array = new TextEncoder().encode(stringdoc);
            const buffer: Buffer = await GeoUtils.toBuffer(uint8array);

            const _cid = await powergate.getAssetCid(buffer);

            ires.cid = _cid;

            await powergate.pin(_cid);
            
            console.log(masterDoc);
        }
    }catch(e){
        throw e;
    }

    return ires;
}

async  function getGeoTIFF(cid: string, targetArea: Array<any>, token: string): Promise<ArrayBuffer>{
    try{
        const powergate = await Powergate.build(token);
        const doc = await powergate.getGeoDIDDocument(cid);

        GeoUtils.bboxtoWindow(image);
        // convert to windows 
        if(doc) {
            // find the data
        }
    }catch(err){
        throw err; 
    }

    return arrayBuffer;
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

        await getGeoTIFF(ires.cid, request, ires.token);
    }catch(err){
        console.log(err)
    }


    //run('http://download.osgeo.org/geotiff/samples/gdal_eg/cea.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/bogota.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/lcc-datum.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/ntf_nord.tif');
}

main();

//run('https://storage.googleapis.com/pdd-stac/disasters/hurricane-harvey/0831/SkySat_Freeport_s03_20170831T162740Z.tif');