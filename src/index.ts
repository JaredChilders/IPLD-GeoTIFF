import fetch from 'cross-fetch';
import { IPFS, create } from 'ipfs'
import { GeoUtils } from './utils/geo-utils';
import CID from 'cids';
import { Tile, IResponse, ImageMetadata, IWrapper, IWrappedWrapper, MasterWrapper, ITransport, BlockData, Resolution } from './interfaces/interfaces'

const Block = require('@ipld/block/defaults');
const dagCBOR = require('ipld-dag-cbor')
const GeoTIFF = require('geotiff');
const { fromUrl, fromUrls, fromArrayBuffer, fromBlob, writeArrayBuffer } = GeoTIFF;
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

async function getTransport(_ipfs: IPFS, _sizeArray: Array<Array<Tile>>, _minW: number, _minH: number): Promise<ITransport>{

    let wrapper: IWrapper = {}

    let bounding_Row: Array<number> = [0,0,0,0];

    for(let i = 0; i < _sizeArray.length; i++){
        for(let j = 0; j < _sizeArray[i].length; j++){
            wrapper[`${_sizeArray[i][j].window}`] = _sizeArray[i][j];

            if((j == 0)){
                bounding_Row[0] = _sizeArray[i][j].window[0];
                bounding_Row[1] = _sizeArray[i][j].window[1];
                bounding_Row[2] = _sizeArray[i][j].window[2]; 
                bounding_Row[3] = _sizeArray[i][j].window[3];
            }

            if((bounding_Row[0] > _sizeArray[i][j].window[0])) bounding_Row[0] = _sizeArray[i][j].window[0];
            else if((bounding_Row[1] > _sizeArray[i][j].window[1])) bounding_Row[1] = _sizeArray[i][j].window[1]; // min h
            else if((bounding_Row[2] < _sizeArray[i][j].window[2])) bounding_Row[2] = _sizeArray[i][j].window[2]; 
            else if((bounding_Row[3] < _sizeArray[i][j].window[3])) bounding_Row[3] = _sizeArray[i][j].window[3]; // min h
        }
    }
    //console.log(wrapper)
    try{
        const cid = await GeoUtils.ipfsPin(_ipfs, wrapper);
        return { cid: cid, boundingRow: bounding_Row, wrapper: wrapper  }
    }catch(err){
        throw err;
    }
}

async function createTheTileArray(_ipfs: IPFS, image: any, current_xTSize: number, current_yTSize: number): Promise<IWrappedWrapper> {

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

    // declare current_ArrayA
    let current_ArrayA : Array<Array<Tile>>;

    // declare current_ArrayB
    let current_ArrayB: Array<Tile>;
    let wrappedWrapper: IWrappedWrapper = {}

    let index: number = 0;
    let info: number = 0;

    let endingA: boolean = false; 
    spinner.start();
    
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
            const max = await getTransport(_ipfs, current_ArrayA, start, i - 1)
            wrappedWrapper[`${max.boundingRow}`] = max.cid; //change to cid 

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
            
            try{
                const tile_data = await image.readRasters({ window: current_window, pool: pool });

                const block = await Block.encoder(tile_data, 'dag-cbor');
                const data = await block.encode();
                const cid = await block.cid();

                // array of tiles 
                const tile: Tile = {
                    window: current_window,
                    cid: cid,
                    data: data,
                    tileSize: {
                        height: tile_data.height,
                        width: tile_data.width
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
            const max = await getTransport(_ipfs, current_ArrayA, start, right_boundary - 1);
            wrappedWrapper[`${max.boundingRow}`] = max.cid;
            // post to Storage
        }

        right_boundary = 0; // reset the right boundary 
        counterB = 0;
        counterA += 1; // increment counter A
    }

    //console.log(wrappedWrapper)

    return wrappedWrapper;
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
 
async function startTile(_ipfs: IPFS, image: any): Promise<IResponse>{

    let ires: IResponse = {
        max_Dimensions: [],
        window: [],
        bbox: []
    }

    let masterDoc: MasterWrapper = {}

    try{

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
            
            let n: number = 4;
            
            while(cont){

                const current_scale = Math.pow(2, n);

                const current_xTSize = image.getTileHeight() * current_scale;
                const current_yTSize = image.getTileHeight() * current_scale;

                if((current_yTSize < max_Height / 2) && (current_xTSize < max_Width)){
                    let block: IWrappedWrapper = await createTheTileArray(_ipfs, image, current_xTSize, current_yTSize);
                    masterDoc[`${current_yTSize}`] = block;
                    ires.max_Dimensions.push(current_yTSize);
                }
                else{
                    // end tiling and get whole image then end while loop
                    let block: IWrappedWrapper = await createTheTileArray(_ipfs, image, max_Width, max_Height);
                    masterDoc[`${max_Height}`] = block;
                    ires.max_Dimensions.push(max_Height);
                    cont = false;
                }
                n += 1;
            }

            //console.log(masterDoc)
            const _cid = await GeoUtils.ipfsPin(_ipfs, masterDoc);

            ires.cid = _cid;

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

// gets the proper GeoTIFF and Tile using IPLD
async  function getGeoTile(_ipfs: IPFS, _cid: CID, max_Dimensions: Array<number>): Promise<any>{

    try{
        // Retrieve IPLD Block from IPFS
        const blockdata: BlockData = await GeoUtils.ipfsGetBlock(_ipfs, _cid)
        // Obtain path to CID of row
        const path = blockdata.pathList[1];
        
        /**
         * Call utils.resolver.resolve to resolve the path in the binary data.
         * The Nested CIDs are tagged bc of the DAG-CBOR Codec. 
         * Returns: metadata of type Resolution
         * {
         *     value: any;
         *     remainderPath: string;
         * }
         * */
        const metadata = await GeoUtils.resolution(blockdata.data, path)
        const row_cid = metadata.value; // The CID of the particular row
        console.log(metadata.value);

        /**
         * Using the IPFS Instance and the row CID, we can query each tile within that row and acces their respective binary data.
         * Each Tile also has a respective CID, so they are also nested within the parent Row CID. 
         */
        const rowblockdata: BlockData = await GeoUtils.ipfsGetBlock(_ipfs, row_cid)
        console.log(rowblockdata.pathList);

        /**
         * Here we define the binary of the Row and the path that we would like to resolve
         */
        const binary = rowblockdata.data;
        const tile_path: string = '0,0,240,240/data';

        /**
         * Again we Call utils.resolver.resolve with the Row Binary and the path to the tile we are trying to resolve to.
         */
        const tile_binary = await GeoUtils.resolution(binary, tile_path)
        console.log(tile_binary.value)

        // Convert the tile back to original format (deserialize the binary)
        const node =  await dagCBOR.util.deserialize(tile_binary.value)
        //console.log(node)

        const binary_data_of_tile = node[0];

        // Define Tile Metadata and the binary of the Tile
        const tile_metadata = {
            height: 240,
            width: 240
          };
        // Write the ArrayBuffer and metadata to a tif file for end user consumption
        const arrayBuffer = await writeArrayBuffer(binary_data_of_tile, tile_metadata);

        return arrayBuffer;

    }catch(err){
        throw err; 
    }    
}

async function main(){
    //let pool = new GeoTIFF.Pool();
    const url = 'http://download.osgeo.org/geotiff/samples/gdal_eg/cea.tif';

    /*
    const request = [
        -28493.166784412522,
        4224973.143255847,
        2358.211624949061,
        4255884.5438021915
    ];*/

    try{
        const ipfs: IPFS = await create();
        const image = await getImageFromUrl(url)
        const ires: IResponse =  await startTile(ipfs, image);

        console.log(ires);

        //const targetWindow: ImageMetadata = await GeoUtils.bboxtoWindow(ires.window, ires.bbox, request);
        //console.log(targetWindow);

        const tiff_of_tile = await getGeoTile(ipfs, ires.cid, ires.max_Dimensions);
        console.log(tiff_of_tile)
    }catch(err){
        console.log(err)
        throw err
    }


    //run('http://download.osgeo.org/geotiff/samples/gdal_eg/cea.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/bogota.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/lcc-datum.tif');
    //run('https://download.osgeo.org/geotiff/samples/made_up/ntf_nord.tif');
}

main();