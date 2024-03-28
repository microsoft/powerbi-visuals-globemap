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

import powerbi from "powerbi-visuals-api";

import DataView = powerbi.DataView;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewValueColumns = powerbi.DataViewValueColumns;

import { GlobeMapBuilder } from "./visualBuilder";
import { GlobeMapData as GlobeMapDataViewBuilder } from "./visualData";

import { GlobeMap as VisualClass } from "../src/globemap";
import { GlobeMapColumns } from "../src/columns";

import { TileMap, ITileGapObject, IGlobeMapObject3DWithToolTipData } from "../src/interfaces/dataInterfaces";

import capabilities from '../capabilities.json';
import PrimitiveValue = powerbi.PrimitiveValue;
import { ILocationKeyDictionary } from "../src/interfaces/locationInterfaces";
import { d3MouseDown, renderTimeout } from "powerbi-visuals-utils-testutils";
import SubSelectionOutlineVisibility = powerbi.visuals.SubSelectionOutlineVisibility;
import ArcSubSelectionOutline = powerbi.visuals.ArcSubSelectionOutline;

describe("GlobeMap", () => {
    let visualBuilder: GlobeMapBuilder,
        visualInstance: VisualClass,
        defaultDataViewBuilder: GlobeMapDataViewBuilder,
        dataView: DataView;

    beforeAll(async() => {
        visualBuilder = new GlobeMapBuilder(1024, 1024);
        visualInstance = visualBuilder.instance;
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

    beforeEach(() => {
        defaultDataViewBuilder = new GlobeMapDataViewBuilder();
        dataView = defaultDataViewBuilder.getDataView();
    });

    describe("DOM tests", () => {
        it("canvas element created", () => {
            console.log("dom test started");

            visualBuilder.updateRenderTimeout(dataView, () => {
                expect(visualBuilder.element.querySelectorAll("canvas")).toBeTruthy();
                console.log("dom test passed");           
            });
        });
    });

    describe("Converter tests", () => {
        it("should create same count of datapoints as dataView values", () => {
            let data = VisualClass.converter(dataView, visualInstance.colors, visualInstance.visualHost, visualInstance.formattingServiceModel);

            expect(data.dataPoints.length).toBe(dataView.categorical!.values![0].values.length);
        });

        it("should create same count of datapoints as valid categories", () => {
            let invalidDataSet = ["0qqa123", "value", 1, 2, 3, 4, 5, 6];

            dataView.categorical!.categories![0].values = invalidDataSet;
            let data = VisualClass.converter(dataView, visualInstance.colors, visualInstance.visualHost, visualInstance.formattingServiceModel);

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
                    VisualClass.converter(dataView, visualInstance.colors, visualInstance.visualHost, visualInstance.formattingServiceModel);
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
                "000": "https://t0.ssl.ak.dynamic.tiles.virtualearth.net/comp/ch/000?mkt=en-US&it=G,L&on=z",
                "001": "https://t1.ssl.ak.dynamic.tiles.virtualearth.net/comp/ch/001?mkt=en-US&it=G,L&on=z",
                "002": "https://t2.ssl.ak.dynamic.tiles.virtualearth.net/comp/ch/002?mkt=en-US&it=G,L&on=z",
                "003": "https://t3.ssl.ak.dynamic.tiles.virtualearth.net/comp/ch/003?mkt=en-US&it=G,L&on=z"
            }];

            const culture: string = "en-US";

            it("for not valid input", async () => {
                const expectedResult = [];
                const tiles = [[]];
                const data: TileMap[] = await visualInstance.extendTiles(JSON.stringify(tiles[0]), culture);
                expect(data.length).toBe(expectedResult.length);
            });

            it("for valid input", async () => {
                const data: TileMap[] = await visualInstance.extendTiles(JSON.stringify(tiles), culture);
                expect(data).not.toBeNull();
                for (let i = 0; i < data.length; i++) {
                    const tile: TileMap = data[i];
                    for (let key in tile) {
                        tile[key] = tile[key].replace(/g=\w+&/g, '');
                        expect(tile[key]).toBe(expectedResult[i][key]);
                    }
                }
            });
        });
    });
    
    describe("OnObject tests", () => {        
        beforeAll((done) => {
            //update with formatMode=true
            visualBuilder.updateRenderTimeout(dataView, done, powerbi.VisualUpdateType.Data, true, 500);
        });

        describe("bar selection tests", () => {
            describe("fast click", () => {
                it("should create active outline for selected bar", (done) => {
                    const barToSubselect = visualInstance.barsGroup.children[0];
                    visualInstance.hoveredBar = barToSubselect as IGlobeMapObject3DWithToolTipData;

                    const pointerDown = new PointerEvent("pointerdown");
                    const pointerUp = new PointerEvent("pointerup");
                    visualBuilder.canvasElement?.dispatchEvent(pointerDown);
                    visualBuilder.canvasElement?.dispatchEvent(pointerUp);

                    renderTimeout(() => {
                        expect(visualInstance.subSelectedBar).toBeDefined();
                        const subselectedBarPosition = visualInstance.worldToScreenPositions(visualInstance.subSelectedBar);

                        const subselectedBarOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                        expect(subselectedBarOutline).toBeDefined();
                        
                        const outlineCenter = (subselectedBarOutline as ArcSubSelectionOutline).center;
                        expect(subselectedBarPosition).toEqual(outlineCenter);
                        done();
                    }, 200);
                });

                it("should create new active outline for selected bar and delete previous active outline", (done) => {
                    const previousActiveOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(previousActiveOutline).toBeDefined();
                    const previousActiveOutlineCenter = (previousActiveOutline as ArcSubSelectionOutline).center;

                    const barToSubselect = visualInstance.barsGroup.children[1];
                    visualInstance.hoveredBar = barToSubselect as IGlobeMapObject3DWithToolTipData;

                    const pointerDown = new PointerEvent("pointerdown");
                    const pointerUp = new PointerEvent("pointerup");
                    visualBuilder.canvasElement?.dispatchEvent(pointerDown);
                    visualBuilder.canvasElement?.dispatchEvent(pointerUp);

                    renderTimeout(() => {
                        expect(visualInstance.subSelectedBar).toBeDefined();
                        const subselectedBarPosition = visualInstance.worldToScreenPositions(visualInstance.subSelectedBar);

                        const subselectedBarOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                        expect(subselectedBarOutline).toBeDefined();
                        
                        const outlineCenter = (subselectedBarOutline as ArcSubSelectionOutline).center;
                        expect(subselectedBarPosition).toEqual(outlineCenter);
                        expect(outlineCenter).not.toEqual(previousActiveOutlineCenter);
                        done();
                    }, 200);
                });

                it("should delete active outlines when clicking not on bar", (done) => {
                    const previousActiveOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(previousActiveOutline).toBeDefined();

                    visualInstance.hoveredBar = null;

                    const pointerDown = new PointerEvent("pointerdown");
                    const pointerUp = new PointerEvent("pointerup");
                    visualBuilder.canvasElement?.dispatchEvent(pointerDown);
                    visualBuilder.canvasElement?.dispatchEvent(pointerUp);

                    renderTimeout(() => {
                        expect(visualInstance.subSelectedBar).toBeFalsy();

                        const subselectedBarOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                        expect(subselectedBarOutline).toBeUndefined();
                        
                        done();
                    }, 200);
                });
            });
            
            describe("slow click", () => {
                it("should create active outline for selected bar", (done) => {
                    expect(visualInstance.subSelectedBar).toBeFalsy();
                    const barToSubselect = visualInstance.barsGroup.children[0];
                    visualInstance.hoveredBar = barToSubselect as IGlobeMapObject3DWithToolTipData;

                    const pointerDown = new PointerEvent("pointerdown");
                    const pointerUp = new PointerEvent("pointerup");
                    visualBuilder.canvasElement?.dispatchEvent(pointerDown);
                    renderTimeout(() => {
                        visualBuilder.canvasElement?.dispatchEvent(pointerUp);
                        renderTimeout(() => {
                            expect(visualInstance.subSelectedBar).toBeDefined();
                            const subselectedBarPosition = visualInstance.worldToScreenPositions(visualInstance.subSelectedBar);

                            const subselectedBarOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                            expect(subselectedBarOutline).toBeDefined();
                            
                            const outlineCenter = (subselectedBarOutline as ArcSubSelectionOutline).center;
                            expect(subselectedBarPosition).toEqual(outlineCenter);
                            done();
                        }, 200);
                    }, 250)
                    
                });

                it("should create new active outline for selected bar and delete previous active outline", (done) => {
                    const previousActiveOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(previousActiveOutline).toBeDefined();
                    const previousActiveOutlineCenter = (previousActiveOutline as ArcSubSelectionOutline).center;

                    const barToSubselect = visualInstance.barsGroup.children[1];
                    visualInstance.hoveredBar = barToSubselect as IGlobeMapObject3DWithToolTipData;

                    const pointerDown = new PointerEvent("pointerdown");
                    const pointerUp = new PointerEvent("pointerup");
                    visualBuilder.canvasElement?.dispatchEvent(pointerDown);
                    renderTimeout(() => {
                        visualBuilder.canvasElement?.dispatchEvent(pointerUp);
                        renderTimeout(() => {
                            expect(visualInstance.subSelectedBar).toBeDefined();
                            const subselectedBarPosition = visualInstance.worldToScreenPositions(visualInstance.subSelectedBar);

                            const subselectedBarOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                            expect(subselectedBarOutline).toBeDefined();
                            
                            const outlineCenter = (subselectedBarOutline as ArcSubSelectionOutline).center;
                            expect(subselectedBarPosition).toEqual(outlineCenter);
                            expect(outlineCenter).not.toEqual(previousActiveOutlineCenter);
                            done();
                        }, 200);
                    }, 250);
                });

                it("active outline should remain when clicking not on bar", (done) => {
                    const activeOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(activeOutline).toBeDefined();
                    const activeOutlineCenter = (activeOutline as ArcSubSelectionOutline).center;

                    visualInstance.hoveredBar = null;

                    const pointerDown = new PointerEvent("pointerdown");
                    const pointerUp = new PointerEvent("pointerup");
                    visualBuilder.canvasElement?.dispatchEvent(pointerDown);
                    renderTimeout(() => {
                        visualBuilder.canvasElement?.dispatchEvent(pointerUp);
                        renderTimeout(() => {
                            expect(visualInstance.subSelectedBar).toBeDefined();
                            const subselectedBarPosition = visualInstance.worldToScreenPositions(visualInstance.subSelectedBar);

                            const subselectedBarOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                            expect(subselectedBarOutline).toBeDefined();
                            
                            const outlineCenter = (subselectedBarOutline as ArcSubSelectionOutline).center;
                            expect(subselectedBarPosition).toEqual(outlineCenter);
                            expect(activeOutlineCenter).toEqual(outlineCenter);
                            done();
                        }, 200);
                    }, 250);
                });

                it("should recalculate active outline for selected bar after pointerdown and pointemove events", (done) => {
                    const activeOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(activeOutline).toBeDefined();
                    const activeOutlineCenter = (activeOutline as ArcSubSelectionOutline).center;

                    visualInstance.hoveredBar = null;

                    const pointerDown = new PointerEvent("pointerdown");
                    const pointerMove = new PointerEvent("pointermove", {clientX: 50, clientY: 50, buttons: 1});
                    const pointerUp = new PointerEvent("pointerup");
                    visualBuilder.canvasElement?.dispatchEvent(pointerDown);
                    visualBuilder.canvasElement?.dispatchEvent(pointerMove);
                    visualBuilder.canvasElement?.dispatchEvent(pointerMove);
                    renderTimeout(() => {
                        visualBuilder.canvasElement?.dispatchEvent(pointerUp);
                        renderTimeout(() => {
                            expect(visualInstance.subSelectedBar).toBeDefined();
                            const subselectedBarPosition = visualInstance.worldToScreenPositions(visualInstance.subSelectedBar);

                            const subselectedBarOutline = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                            expect(subselectedBarOutline).toBeDefined();
                            
                            const outlineCenter = (subselectedBarOutline as ArcSubSelectionOutline).center;
                            expect(subselectedBarPosition).toEqual(outlineCenter);
                            expect(activeOutlineCenter).not.toEqual(outlineCenter);
                            done();
                        }, 500);
                    }, 500);
                });
            });
        });

        describe("wheel event tests:", () => {
            beforeAll((done) => {
                //subselect bar before testing wheel behavior
                const barToSubselect = visualInstance.barsGroup.children[0];
                visualInstance.subSelectedBar = barToSubselect as IGlobeMapObject3DWithToolTipData;
                visualInstance.needsRender = true;

                renderTimeout(done, 500);
            });

            it("should recalculate Active outline after wheel zoom in", (done) => {
                const outlineBeforeZoom = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                const outlineCenterBeforeZoom = (outlineBeforeZoom as ArcSubSelectionOutline).center;
                const wheelEvent = new WheelEvent("wheel", {deltaY: -125});
                visualBuilder.canvasElement?.dispatchEvent(wheelEvent);
                renderTimeout(() => {
                    const barAfterZoom = visualInstance.subSelectedBar;
                    const barPositionAfterZoom = visualInstance.worldToScreenPositions(barAfterZoom);

                    const outlineAfterZoom = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(outlineAfterZoom).toBeDefined();
                    
                    const outlineCenterAfterZoom = (outlineAfterZoom as ArcSubSelectionOutline).center;
                    expect(barPositionAfterZoom).toEqual(outlineCenterAfterZoom);
                    expect(outlineCenterBeforeZoom.x).toBeGreaterThan(outlineCenterAfterZoom.x);
                    expect(outlineCenterBeforeZoom.y).toBeLessThan(outlineCenterAfterZoom.y);
                    done();
                }, 500);
            });

            it("should recalculate Active outline after wheel zoom out", (done) => {
                const outlineBeforeZoom = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                const outlineCenterBeforeZoom = (outlineBeforeZoom as ArcSubSelectionOutline).center;
                const wheelEvent = new WheelEvent("wheel", {deltaY: 125});
                visualBuilder.canvasElement?.dispatchEvent(wheelEvent);
                renderTimeout(() => {
                    const barAfterZoom = visualInstance.subSelectedBar;
                    const barPositionAfterZoom = visualInstance.worldToScreenPositions(barAfterZoom);

                    const outlineAfterZoom = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(outlineAfterZoom).toBeDefined();
                    
                    const outlineCenterAfterZoom = (outlineAfterZoom as ArcSubSelectionOutline).center;
                    expect(barPositionAfterZoom).toEqual(outlineCenterAfterZoom);
                    expect(outlineCenterBeforeZoom.x).toBeLessThan(outlineCenterAfterZoom.x);
                    expect(outlineCenterBeforeZoom.y).toBeGreaterThan(outlineCenterAfterZoom.y);
                    done();
                }, 500);
            });
        });

        describe("control buttons tests:", () => {
            beforeAll((done) => {
                //subselect bar before testing control buttons
                const barToSubselect = visualInstance.barsGroup.children[0];
                visualInstance.subSelectedBar = barToSubselect as IGlobeMapObject3DWithToolTipData;
                visualInstance.needsRender = true;

                renderTimeout(done, 500);
            });

            it("should recalculate Active outline after right control button click", (done) => {
                const outlineBeforeClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                const outlineCenterBeforeClick = (outlineBeforeClick as ArcSubSelectionOutline).center;
                d3MouseDown(visualBuilder.rightControlElement, 0, 0);
                renderTimeout(() => {
                    const barAfterClick = visualInstance.subSelectedBar;
                    const barPositionAfterClick = visualInstance.worldToScreenPositions(barAfterClick);

                    const outlineAfterClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(outlineAfterClick).toBeDefined();
                    
                    const outlineCenterAfterClick = (outlineAfterClick as ArcSubSelectionOutline).center;
                    expect(barPositionAfterClick).toEqual(outlineCenterAfterClick);
                    expect(outlineCenterBeforeClick.x).toBeGreaterThan(outlineCenterAfterClick.x);
                    done();
                }, 500);
            });

            it("should recalculate Active outline after left control button click", (done) => {
                const outlineBeforeClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                const outlineCenterBeforeClick = (outlineBeforeClick as ArcSubSelectionOutline).center;
                d3MouseDown(visualBuilder.leftControlElement, 0, 0);
                renderTimeout(() => {
                    const barAfterClick = visualInstance.subSelectedBar;
                    const barPositionAfterClick = visualInstance.worldToScreenPositions(barAfterClick);

                    const outlineAfterClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(outlineAfterClick).toBeDefined();
                    
                    const outlineCenterAfterClick = (outlineAfterClick as ArcSubSelectionOutline).center;                    
                    expect(barPositionAfterClick).toEqual(outlineCenterAfterClick);
                    expect(outlineCenterBeforeClick.x).toBeLessThan(outlineCenterAfterClick.x);
                    done();
                }, 500);
            });

            it("should recalculate Active outline after up control button click", (done) => {
                const outlineBeforeClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                const outlineCenterBeforeClick = (outlineBeforeClick as ArcSubSelectionOutline).center;
                d3MouseDown(visualBuilder.upControlElement, 0, 0);
                renderTimeout(() => {
                    const barAfterClick = visualInstance.subSelectedBar;
                    const barPositionAfterClick = visualInstance.worldToScreenPositions(barAfterClick);

                    const outlineAfterClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(outlineAfterClick).toBeDefined();
                    
                    const outlineCenterAfterClick = (outlineAfterClick as ArcSubSelectionOutline).center;
                    expect(barPositionAfterClick).toEqual(outlineCenterAfterClick);
                    expect(outlineCenterBeforeClick.y).toBeLessThan(outlineCenterAfterClick.y);
                    done();
                }, 500);
            });

            it("should recalculate Active outline after down control button click", (done) => {
                const outlineBeforeClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                const outlineCenterBeforeClick = (outlineBeforeClick as ArcSubSelectionOutline).center;
                d3MouseDown(visualBuilder.downControlElement, 0, 0);
                renderTimeout(() => {
                    const barAfterClick = visualInstance.subSelectedBar;
                    const barPositionAfterClick = visualInstance.worldToScreenPositions(barAfterClick);

                    const outlineAfterClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(outlineAfterClick).toBeDefined();
                    
                    const outlineCenterAfterClick = (outlineAfterClick as ArcSubSelectionOutline).center;                    
                    expect(barPositionAfterClick).toEqual(outlineCenterAfterClick);
                    expect(outlineCenterBeforeClick.y).toBeGreaterThan(outlineCenterAfterClick.y);
                    done();
                }, 500);
            });

            it("should recalculate Active outline after zoom up control button click", (done) => {
                const outlineBeforeClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                const outlineCenterBeforeClick = (outlineBeforeClick as ArcSubSelectionOutline).center;
                d3MouseDown(visualBuilder.zoomUpControlElement, 0, 0);
                renderTimeout(() => {
                    const barAfterClick = visualInstance.subSelectedBar;
                    const barPositionAfterClick = visualInstance.worldToScreenPositions(barAfterClick);

                    const outlineAfterClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(outlineAfterClick).toBeDefined();

                    const outlineCenterAfterClick = (outlineAfterClick as ArcSubSelectionOutline).center;
                    expect(barPositionAfterClick).toEqual(outlineCenterAfterClick);
                    expect(outlineCenterBeforeClick.x).toBeGreaterThan(outlineCenterAfterClick.x);
                    expect(outlineCenterBeforeClick.y).toBeLessThan(outlineCenterAfterClick.y);
                    done();
                }, 500);
            });

            it("should recalculate Active outline after zoom down control button click", (done) => {
                const outlineBeforeClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                const outlineCenterBeforeClick = (outlineBeforeClick as ArcSubSelectionOutline).center;

                d3MouseDown(visualBuilder.zoomDownControlElement, 0, 0);
                renderTimeout(() => {
                    const barAfterClick = visualInstance.subSelectedBar;
                    const barPositionAfterClick = visualInstance.worldToScreenPositions(barAfterClick);

                    const outlineAfterClick = visualInstance.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active)?.outline;
                    expect(outlineAfterClick).toBeDefined();
                    
                    const outlineCenterAfterClick = (outlineAfterClick as ArcSubSelectionOutline).center;
                    expect(barPositionAfterClick).toEqual(outlineCenterAfterClick);
                    expect(outlineCenterBeforeClick.x).toBeLessThan(outlineCenterAfterClick.x);
                    expect(outlineCenterBeforeClick.y).toBeGreaterThan(outlineCenterAfterClick.y);
                    done();
                }, 500);
            });
        });
    });
});
