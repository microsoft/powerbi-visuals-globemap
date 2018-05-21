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

/// <reference path="_references.ts"/>

module powerbi.extensibility.visual.test {
    // powerbi
    import DataView = powerbi.DataView;
    import DataViewCategorical = powerbi.DataViewCategorical;

    // powerbi.extensibility.visual.test
    import GlobeMapDataViewBuilder = powerbi.extensibility.visual.test.GlobeMapData;
    import GlobeMapBuilder = powerbi.extensibility.visual.test.GlobeMapBuilder;

    // powerbi.extensibility.visual.GlobeMap1447669447625
    import VisualClass = powerbi.extensibility.visual.GlobeMap1447669447625.GlobeMap;
    import GlobeMapData = powerbi.extensibility.visual.GlobeMap1447669447625.GlobeMapData;
    import GlobeMapColumns = powerbi.extensibility.visual.GlobeMap1447669447625.GlobeMapColumns;

    // powerbi.extensibility.utils.test
    import clickElement = powerbi.extensibility.utils.test.helpers.clickElement;
    import renderTimeout = powerbi.extensibility.utils.test.helpers.renderTimeout;
    import getRandomNumbers = powerbi.extensibility.utils.test.helpers.getRandomNumbers;
    import assertColorsMatch = powerbi.extensibility.utils.test.helpers.color.assertColorsMatch;

    describe("GlobeMap", () => {
        let visualBuilder: GlobeMapBuilder,
            visualInstance: VisualClass,
            defaultDataViewBuilder: GlobeMapDataViewBuilder,
            dataView: DataView;

        beforeEach(() => {
            jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;
            visualBuilder = new GlobeMapBuilder(1024, 1024);

            defaultDataViewBuilder = new GlobeMapDataViewBuilder();
            dataView = defaultDataViewBuilder.getDataView();

            visualInstance = visualBuilder.instance;
        });

        describe("DOM tests", () => {
            it("canvas element created", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    expect(visualBuilder.element.find("canvas")).toBeInDOM();
                    done();
                });
            });
        });

        describe("Converter tests", () => {
            it("should create same count of datapoints as dataView values", () => {
                let data = VisualClass.converter(dataView, visualInstance.colors, visualInstance.visualHost);

                expect(data.dataPoints.length).toBe(dataView.categorical.values[0].values.length);
            });

            it("should create same count of datapoints as dataView values with undefined values", () => {
                dataView.categorical.values[0].values = [null, "0qqa123", undefined, "value", 1, 2, 3, 4, 5, 6];
                let data = VisualClass.converter(dataView, visualInstance.colors, visualInstance.visualHost);

                expect(data.dataPoints.length).toBe(dataView.categorical.values[0].values.length);
            });

            it("should create same count of datapoints as valid categories", () => {
                let invalidDataSet = [null, "0qqa123", undefined, "value", 1, 2, 3, 4, 5, 6];
                let validStringValueCount = 0;

                invalidDataSet.forEach((item) => {
                    if (typeof item === "string") {
                        ++validStringValueCount;
                    }
                });

                dataView.categorical.categories[0].values = invalidDataSet;

                let data = VisualClass.converter(dataView, visualInstance.colors, visualInstance.visualHost);

                expect(data.dataPoints.length).toBe(validStringValueCount);
            });
        });

        describe("columns tests", function () {
            it("getCategoricalColumns should return same count of category values as dataView contains", function () {
                let categorical: GlobeMapColumns<DataViewCategoryColumn & DataViewValueColumn[] & DataViewValueColumns> = GlobeMapColumns.getCategoricalColumns(dataView);

                let categoryCount = categorical.Location && categorical.Location.values && categorical.Location.values.length;
                expect(categoryCount).toBe(dataView.categorical.values[0].values.length);
            });

            it("getGroupedValueColumns should group dataView columns", function () {
                let groupedColumns: GlobeMapColumns<DataViewValueColumn>[] = GlobeMapColumns.getGroupedValueColumns(dataView);
                expect(groupedColumns.length).toBe(1);
            });
            it("getCategoricalValueByIndex should return longitude value", function () {
                let longitude: string = VisualClass.getCategoricalValueByIndex(dataView.categorical.values[1], 1);
                expect(longitude).toEqual(`${dataView.categorical.values[1].values[1]}`);
            });

            it("getCategoricalValueByIndex should return latitude value", function () {
                let latitude: string = VisualClass.getCategoricalValueByIndex(dataView.categorical.values[2], 1);
                expect(latitude).toEqual(`${dataView.categorical.values[2].values[1]}`);
            });
        });
    });

    describe("Capabilities tests", () => {
            it("all items having displayName should have displayNameKey property", () => {
                jasmine.getJSONFixtures().fixturesPath = "base";

                let jsonData = getJSONFixture("capabilities.json");

                let objectsChecker: Function = (obj) => {
                    for (let property in obj) {
                        let value: {displayName, displayNameKey} = obj[property];

                        if (value.displayName) {
                            expect(value.displayNameKey).toBeDefined();
                        }

                        if (typeof value === "object") {
                            objectsChecker(value);
                        }
                    }
                };

                objectsChecker(jsonData);
            });
        });
}
