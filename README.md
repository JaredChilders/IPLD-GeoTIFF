# Geotiff-Ipld

## Introduction
One of Astral's main tenets, was to bring cloud native Geospatial capabilities to the Web3 space. While working with Protocol Labs tech for the past few months, we gained some insight into how, IPLD data structures, libp2p, IPFS, FFS, can enable us to make the aforementioned a reality.

We knew we had to experiment with different pieces of tech, in order to understand what's possible, and what we could do to improve the existing tools. With Raster Imagery being so important to the Geospatial community, we challenged ourselves to figure out how we could  bring Cloud Optimized GeoTIFF-esque type functionality to IPFS/FFS. In order to understand what we're trying to accomplish, we need to first understand what is a TIFF and GeoTIFF.


## Replacing the GeoTIFFs IFD with IPLD
Essentially our goal is to take a GeoTIFF (that is a STRIPE image in this stage), pre-process the image by tiling the STRIPE image and then creating the respective overviews for each tile. Instead of the tiles and overviews being stored in the TIFFs IFD (Image File Directory), we’re thinking we can use IPLD to store the tiles and overviews instead. With each tile/overview having their own CID, we can then use  to query the proper tiles/overviews. 
In theory it sounds like it would work, and we know there will be some downsides to this approach (speed, efficiency, and lack of adoption for right now). But we would still like to see where this could go and if IPLD could be used to enable CID GET Range requests for geospatial raster data. 
