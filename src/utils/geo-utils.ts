import {Decimal} from 'decimal.js';

export interface ImageMetadata{
    o_window: Array<number>;
    i_window: Array<any>;
    o_bbox: Array<number>;
    i_bbox: Array<any>;
}

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

    //figure out which pixel corresponds to a given latitude and longitude


    // send the bbox of the image through here 
    // window = [ left , top , right , bottom ]
    // bbox = [ min Longitude < -180 to 180 > , min Latitude < -90 to 90 >, max Longitude < -90 to 90 >, max Latitude ]
    static async bboxtoWindow(image: any, _request_bbox: Array<number>): Promise<ImageMetadata>{
        // perform all 4 
        //const _origin = image.getOrigin();
        const _bbox = image.getBoundingBox();

        const _width = image.getWidth();
        const _height = image.getHeight();

        const bboxWidth = _bbox[ 2 ] - _bbox[ 0 ];
        const bboxHeight = _bbox[ 3 ] - _bbox[ 1 ];

        const o_window = [0 , 0, _width, _height]
        
        let i_window: Array<number> = []

        let window_delta: Decimal = new Decimal(0);

        try{
            let i: number = 0;

            await _bbox.forEach((element: number) => { 
                
                if((i % 2) == 0){
                    if((_request_bbox[i] < _bbox[0]) || (_request_bbox[i] > _bbox[2])) throw new Error(`Coordinate ${_request_bbox[i]}` + ' is not within the bounding box. Please enter correct bounding box coordinates.')
                    else i_window.push(Math.abs(Math.floor( _width * ((_request_bbox[0] - element) / bboxWidth))));
                }else{
                    if((_request_bbox[i] < _bbox[1]) || (_request_bbox[i] > _bbox[3])) throw new Error(`Coordinate  ${_request_bbox[i]}` + ' is not within the bounding box. Please enter correct bounding box coordinates.')
                    i_window.push(Math.abs(Math.floor( _height * ((_request_bbox[1] - element) / bboxHeight))));
                } 
                
                i+=1; 
            })
        }catch(e){ throw e; }
        
        return {o_window: o_window, i_window: i_window, o_bbox: _bbox, i_bbox: _request_bbox}
    }
}