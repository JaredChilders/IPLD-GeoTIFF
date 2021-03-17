import {Decimal} from 'decimal.js';
import { ImageMetadata} from '../interfaces/interfaces';
import CID from 'cids';
import multihashing from 'multihashing-async';

//const multihashing = require('multihashing-async')

export class GeoUtils{
    static async toBuffer(ab: ArrayBuffer): Promise<Buffer> {
        var buf = Buffer.alloc(ab.byteLength);
        var view = new Uint8Array(ab);
        for (var i = 0; i < buf.length; ++i) {
            buf[i] = view[i];
        }
        return buf;
    }

    static async toArrayBuffer(buf: Buffer): Promise<ArrayBuffer> {
        var ab = new ArrayBuffer(buf.length);
        var view = new Uint8Array(ab);
        for (var i = 0; i < buf.length; ++i) {
            view[i] = buf[i];
        }
        return ab;
    }

    static async getCID(bytes: any): Promise<CID>{
        try{
            const hash = await multihashing(bytes, 'sha2-256')
            const cid: CID = new CID(1, 'dag-cbor', hash)
            return cid
        } catch(e){
            throw e;
        }
    }

    // TODO: figure out which pixel corresponds to a given latitude and longitude <Completed>
    // window = [ left , top , right , bottom ]
    // bbox = [ min Longitude < -180 to 180 > , min Latitude < -90 to 90 >, max Longitude < -90 to 90 >, max Latitude ]
    static async bboxtoWindow(i_window: Array<number>, _bbox: Array<number>, _request_bbox: Array<number>): Promise<ImageMetadata>{

        const _width = i_window[2];
        const _height = i_window[3];

        const bboxWidth = _bbox[ 2 ] - _bbox[ 0 ];
        const bboxHeight = _bbox[ 3 ] - _bbox[ 1 ];
        
        let o_window: Array<number> = [];

        try{
            let i: number = 0;
            await _bbox.forEach((element: number) => { 
                if((i % 2) == 0){
                    if((_request_bbox[i] < _bbox[0]) || (_request_bbox[i] > _bbox[2])) throw new Error(`Coordinate ${_request_bbox[i]}` + ' is not within the bounding box. Please enter correct bounding box coordinates.')
                    else o_window.push(Math.abs(Math.floor( _width * ((_request_bbox[0] - element) / bboxWidth))));
                }else{
                    if((_request_bbox[i] < _bbox[1]) || (_request_bbox[i] > _bbox[3])) throw new Error(`Coordinate  ${_request_bbox[i]}` + ' is not within the bounding box. Please enter correct bounding box coordinates.')
                    else o_window.push(Math.abs(Math.floor( _height * ((_request_bbox[1] - element) / bboxHeight))));
                } 
                i+=1; 
            })
        }catch(e){ throw e; }
        
        return {i_window: i_window, o_window: o_window, i_bbox: _bbox, o_bbox: _request_bbox}
    }
}