// <copyright company="Microsoft">
//     Copyright (c) 2006-2009 Microsoft Corporation.  All rights reserved.
// </copyright>

export class TileSystem {
    private static EarthRadius: number = 6378137;
    private static MinLatitude: number = -85.05112878;
    private static MaxLatitude: number = 85.05112878;
    private static MinLongitude: number = -180;
    private static MaxLongitude: number = 180;

    /// <summary>
    /// Clips a number to the specified minimum and maximum values.
    /// </summary>
    /// <param name="n">The number to clip.</param>
    /// <param name="minValue">Minimum allowable value.</param>
    /// <param name="maxValue">Maximum allowable value.</param>
    /// <returns>The clipped value.</returns>
    private static Clip(n: number, minValue: number, maxValue: number): number {
        return Math.min(Math.max(n, minValue), maxValue);
    }

    /// <summary>
    /// Determines the map width and height (in pixels) at a specified level
    /// of detail.
    /// </summary>
    /// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
    /// to 23 (highest detail).</param>
    /// <returns>The map width and height in pixels.</returns>
    public static  MapSize(levelOfDetail: number): number {
        return 256 << levelOfDetail;
    }

    /// <summary>
    /// Determines the ground resolution (in meters per pixel) at a specified
    /// latitude and level of detail.
    /// </summary>
    /// <param name="latitude">Latitude (in degrees) at which to measure the
    /// ground resolution.</param>
    /// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
    /// to 23 (highest detail).</param>
    /// <returns>The ground resolution, in meters per pixel.</returns>
    public static GroundResolution(latitude: number, levelOfDetail: number): number {
        latitude = this.Clip(latitude, this.MinLatitude, this.MaxLatitude);
        return Math.cos(latitude * Math.PI / 180) * 2 * Math.PI * this.EarthRadius / this.MapSize(levelOfDetail);
    }

    /// <summary>
    /// Determines the map scale at a specified latitude, level of detail,
    /// and screen resolution.
    /// </summary>
    /// <param name="latitude">Latitude (in degrees) at which to measure the
    /// map scale.</param>
    /// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
    /// to 23 (highest detail).</param>
    /// <param name="screenDpi">Resolution of the screen, in dots per inch.</param>
    /// <returns>The map scale, expressed as the denominator N of the ratio 1 : N.</returns>
    public static MapScale(latitude: number, levelOfDetail: number, screenDpi: number): number {
        return this.GroundResolution(latitude, levelOfDetail) * screenDpi / 0.0254;
    }

    /// <summary>
    /// Converts a point from latitude/longitude WGS-84 coordinates (in degrees)
    /// into pixel XY coordinates at a specified level of detail.
    /// </summary>
    /// <param name="latitude">Latitude of the point, in degrees.</param>
    /// <param name="longitude">Longitude of the point, in degrees.</param>
    /// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
    /// to 23 (highest detail).</param>
    /// <param name="pixelX">Output parameter receiving the X coordinate in pixels.</param>
    /// <param name="pixelY">Output parameter receiving the Y coordinate in pixels.</param>
    public static LatLongToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelX: number, pixelY: number): void {
        latitude = this.Clip(latitude, this.MinLatitude, this.MaxLatitude);
        longitude = this.Clip(longitude, this.MinLongitude, this.MaxLongitude);

        const x: number = (longitude + 180) / 360;
        const sinLatitude: number = Math.sin(latitude * Math.PI / 180);
        const y: number = 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI);

        const mapSize: number = this.MapSize(levelOfDetail);
        pixelX = this.Clip(x * mapSize + 0.5, 0, mapSize - 1); // int
        pixelY = this.Clip(y * mapSize + 0.5, 0, mapSize - 1); // int
    }

    /// <summary>
    /// Converts a pixel from pixel XY coordinates at a specified level of detail
    /// into latitude/longitude WGS-84 coordinates (in degrees).
    /// </summary>
    /// <param name="pixelX">X coordinate of the point, in pixels.</param>
    /// <param name="pixelY">Y coordinates of the point, in pixels.</param>
    /// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
    /// to 23 (highest detail).</param>
    /// <param name="latitude">Output parameter receiving the latitude in degrees.</param>
    /// <param name="longitude">Output parameter receiving the longitude in degrees.</param>
    public static PixelXYToLatLong(pixelX: number, pixelY: number, levelOfDetail: number, latitude: number, longitude: number): void {
        const mapSize: number = this.MapSize(levelOfDetail);
        const x: number = (this.Clip(pixelX, 0, mapSize - 1) / mapSize) - 0.5;
        const y: number = 0.5 - (this.Clip(pixelY, 0, mapSize - 1) / mapSize);

        latitude = 90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI;
        longitude = 360 * x;
    }

    /// <summary>
    /// Converts pixel XY coordinates into tile XY coordinates of the tile containing
    /// the specified pixel.
    /// </summary>
    /// <param name="pixelX">Pixel X coordinate.</param>
    /// <param name="pixelY">Pixel Y coordinate.</param>
    /// <param name="tileX">Output parameter receiving the tile X coordinate.</param>
    /// <param name="tileY">Output parameter receiving the tile Y coordinate.</param>
    public static PixelXYToTileXY(pixelX: number, pixelY: number, tileX: number, tileY: number): void {
        tileX = pixelX / 256;
        tileY = pixelY / 256;
    }

    /// <summary>
    /// Converts tile XY coordinates into pixel XY coordinates of the upper-left pixel
    /// of the specified tile.
    /// </summary>
    /// <param name="tileX">Tile X coordinate.</param>
    /// <param name="tileY">Tile Y coordinate.</param>
    /// <param name="pixelX">Output parameter receiving the pixel X coordinate.</param>
    /// <param name="pixelY">Output parameter receiving the pixel Y coordinate.</param>
    public static TileXYToPixelXY(tileX: number, tileY: number, pixelX: number, pixelY: number): void {
        pixelX = tileX * 256;
        pixelY = tileY * 256;
    }

    /// <summary>
    /// Converts tile XY coordinates into a QuadKey at a specified level of detail.
    /// </summary>
    /// <param name="tileX">Tile X coordinate.</param>
    /// <param name="tileY">Tile Y coordinate.</param>
    /// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
    /// to 23 (highest detail).</param>
    /// <returns>A string containing the QuadKey.</returns>
    public static  TileXYToQuadKey(tileX: number, tileY: number, levelOfDetail: number): string {
        const quadKey: number[] = [];
        for (let i = levelOfDetail; i > 0; i--) {
            let digit: number = 0;
            const mask: number = 1 << (i - 1);
            if ((tileX & mask) !== 0) {
                digit++;
            }
            if ((tileY & mask) !== 0) {
                digit++;
                digit++;
            }
            quadKey.push(digit); // .append?
        }
        return quadKey.toString();
    }

    /// <summary>
    /// Converts a QuadKey into tile XY coordinates.
    /// </summary>
    /// <param name="quadKey">QuadKey of the tile.</param>
    /// <param name="tileX">Output parameter receiving the tile X coordinate.</param>
    /// <param name="tileY">Output parameter receiving the tile Y coordinate.</param>
    /// <param name="levelOfDetail">Output parameter receiving the level of detail.</param>
    public static QuadKeyToTileXY(quadKey: string, tileX: number, tileY: number, levelOfDetail: number): void {
        tileX = tileY = 0;
        levelOfDetail = quadKey.length;
        for (let i = levelOfDetail; i > 0; i--) {
            const mask: number = 1 << (i - 1);
            switch (quadKey[levelOfDetail - i]) {
                case '0':
                    break;

                case '1':
                    tileX |= mask;
                    break;

                case '2':
                    tileY |= mask;
                    break;

                case '3':
                    tileX |= mask;
                    tileY |= mask;
                    break;

                default:
                    throw new Error("Invalid QuadKey digit sequence.");
            }
        }
    }
}
