/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */
// powerbi
import powerbi from "powerbi-visuals-api";

import DataView = powerbi.DataView;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewValueColumns = powerbi.DataViewValueColumns;

import { GlobeMapBuilder } from "./visualBuilder";
import { GlobeMapData as GlobeMapDataViewBuilder } from "./visualData";

import { GlobeMap as VisualClass } from "../src/globemap";
import { GlobeMapColumns } from "../src/columns";

import { TileMap, ITileGapObject, ILocationKeyDictionary } from "../src/interfaces/dataInterfaces";

import capabilities from '../capabilities.json';
import PrimitiveValue = powerbi.PrimitiveValue;

describe("GlobeMap", () => {
    let visualBuilder: GlobeMapBuilder,
        visualInstance: VisualClass,
        defaultDataViewBuilder: GlobeMapDataViewBuilder,
        dataView: DataView;

    beforeAll(() => {
        visualBuilder = new GlobeMapBuilder(1024, 1024);
        visualInstance = visualBuilder.instance;
    });

    beforeEach(() => {
        defaultDataViewBuilder = new GlobeMapDataViewBuilder();
        dataView = defaultDataViewBuilder.getDataView();
    });

    describe("DOM tests", () => {

        beforeAll(async () => {
            console.log("jasmine.DEFAULT_TIMEOUT_INTERVAL", jasmine.DEFAULT_TIMEOUT_INTERVAL);
            
            defaultDataViewBuilder = new GlobeMapDataViewBuilder();
            dataView = defaultDataViewBuilder.getDataView();

            let categoricalColumns = GlobeMapColumns.getCategoricalColumns(dataView);
            
            let locations = categoricalColumns.Location.values as PrimitiveValue[];
            let locationsNeedToBeLoaded = {} as ILocationKeyDictionary;

            locations.forEach((locationName) => {
                const name = (locationName as string).toLowerCase();
                locationsNeedToBeLoaded[name] = {
                    place: name, 
                    locationType: ""
                };
            });

            const coordinates = await visualInstance.cacheManager.loadCoordinates(locationsNeedToBeLoaded);
            
            if (Object.keys(coordinates).length > 0) {
                await visualInstance.cacheManager.saveCoordinates(coordinates);
            }
        });

        it("canvas element created", () => {
            console.log("dom test started");

            visualBuilder.updateRenderTimeout(dataView, () => {
                expect(visualBuilder.element.querySelectorAll("canvas")).toBeTruthy();
                //await Promise.resolve();
                console.log("dom test passed");                
            });
        });
    });

    describe("Converter tests", () => {
        it("should create same count of datapoints as dataView values", () => {
            let data = VisualClass.converter(dataView, visualInstance.colors, visualInstance.visualHost);

            expect(data.dataPoints.length).toBe(dataView.categorical!.values![0].values.length);
        });

        it("should create same count of datapoints as valid categories", () => {
            let invalidDataSet = ["0qqa123", "value", 1, 2, 3, 4, 5, 6];

            dataView.categorical!.categories![0].values = invalidDataSet;
            let data = VisualClass.converter(dataView, visualInstance.colors, visualInstance.visualHost);

            expect(data.dataPoints.length).toBe(dataView.categorical!.categories![0].values.length);
        });

        describe("Data fields", () => {
            let dataView: DataView;

            beforeEach(() => {
                dataView = defaultDataViewBuilder.getDataView([
                    GlobeMapDataViewBuilder.ColumnLatitude,
                    GlobeMapDataViewBuilder.ColumnLongitude,
                    GlobeMapDataViewBuilder.ColumnValue,
                ]);
            });

            it("Location should not be mandatory", () => {
                expect(() => {
                    VisualClass.converter(dataView, visualInstance.colors, visualInstance.visualHost);
                }).not.toThrow();
            });
        });
    });

    describe("Columns tests", function () {
        it("getCategoricalColumns should return same count of category values as dataView contains", function () {
            let categorical: GlobeMapColumns<DataViewCategoryColumn | DataViewValueColumn[] | DataViewValueColumns> = GlobeMapColumns.getCategoricalColumns(dataView);

            let categoryCount = categorical.Location && categorical.Location.values && categorical.Location.values.length;
            expect(categoryCount).toBe(dataView.categorical!.values![0].values.length);
        });

        it("getGroupedValueColumns should group dataView columns", function () {
            let groupedColumns: GlobeMapColumns<DataViewValueColumn>[] = GlobeMapColumns.getGroupedValueColumns(dataView);
            expect(groupedColumns.length).toBe(1);
        });

        it("getCategoricalValueByIndex should return longitude value", function () {
            let longitude: string = VisualClass.getCategoricalValueByIndex(dataView.categorical!.values![1], 1);
            expect(longitude).toEqual(`${dataView.categorical!.values![1].values[1]}`);
        });

        it("getCategoricalValueByIndex should return latitude value", function () {
            let latitude: string = VisualClass.getCategoricalValueByIndex(dataView.categorical!.values![2], 1);
            expect(latitude).toEqual(`${dataView.categorical!.values![2].values[1]}`);
            
        });
    });

    describe("Capabilities tests", () => {
        it("all items having displayName should have displayNameKey property", () => {
            let objectsChecker: Function = (obj) => {
                for (let property in obj) {
                    let value: { displayName, displayNameKey } = obj[property];

                    if (value.displayName) {
                        expect(value.displayNameKey).toBeDefined();
                    }

                    if (typeof value === "object") {
                        objectsChecker(value);
                    }
                }
            };

            objectsChecker(capabilities.objects);
        });
    });

    describe("LocalStorage and related methods test: ", () => {
        describe("minimize tiles test", () => {

            it("on valid keys", () => {
                const rawTiles = [
                    {
                        "000": "https://ecn.t0.tiles.virtualearth.net/tiles/r000.jpeg?g=6782&mkt=en-US&shading=hill",
                        "001": "https://ecn.t1.tiles.virtualearth.net/tiles/r001.jpeg?g=6782&mkt=en-US&shading=hill",
                        "002": "https://ecn.t2.tiles.virtualearth.net/tiles/r002.jpeg?g=6782&mkt=en-US&shading=hill",
                        "003": "https://ecn.t3.tiles.virtualearth.net/tiles/r003.jpeg?g=6782&mkt=en-US&shading=hill"
                    }
                ];

                const expectedTiles: ITileGapObject[] = [
                    { gaps: [[0, 3]], rank: 3 }
                ];

                const result: ITileGapObject[] = VisualClass.minimizeTiles(rawTiles);

                expect(result.length).toEqual(expectedTiles.length);
                for (let i = 0; i < result.length; i++) {
                    expect(expectedTiles[i].rank).toEqual(result[i].rank);
                    expect(expectedTiles[i].gaps).toEqual(result[i].gaps);
                }
            });

            it("on not valid keys", () => {
                const notValidTiles = [[]];
                notValidTiles.forEach((notValidData) => {
                    const result = VisualClass.minimizeTiles(notValidData);
                    expect(result.length).toBe(0);
                });
            });
        });
    
        describe("extend tiles test", () => {
            const tiles: ITileGapObject[] = [
                { gaps: [[0, 3]], rank: 3 }
            ];

            const expectedResult = [
                {
                    "000": "https://ecn.t1.tiles.virtualearth.net/tiles/r000.jpeg?mkt=en-US&shading=hill",
                    "001": "https://ecn.t1.tiles.virtualearth.net/tiles/r001.jpeg?mkt=en-US&shading=hill",
                    "002": "https://ecn.t1.tiles.virtualearth.net/tiles/r002.jpeg?mkt=en-US&shading=hill",
                    "003": "https://ecn.t1.tiles.virtualearth.net/tiles/r003.jpeg?mkt=en-US&shading=hill"
                }
            ];

            const culture: string = "en-US";

            it("for not valid input", () => {
                const expectedResult = [];
                const tiles = [[]];
                tiles.forEach((tile) => {
                    visualInstance.extendTiles(JSON.stringify(tile), culture)
                        .then((data: TileMap[]) => {
                            expect(data.length).toBe(expectedResult.length);
                        });
                });
            });

            it("for valid input", () => {
                visualInstance.extendTiles(JSON.stringify(tiles), culture)
                    .then((data: TileMap[]) => {
                        expect(data).not.toBeNull();
                        for (let i = 0; data.length; i++) {
                            const tile: TileMap = data[i];
                            for (let key in tile) {
                                tile[key] = tile[key].replace(/g=\w+&/g, '');
                            }
                            expect(data[i]).toBe(expectedResult[i]);
                        }
                    });
            });
        });
    });
});
