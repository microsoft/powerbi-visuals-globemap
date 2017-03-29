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

/// <reference path="_references.ts" />

module powerbi.extensibility.visual.test {
    // powerbi.extensibility.utils.type
    import ValueType = powerbi.extensibility.utils.type.ValueType;
    import typeUtils = powerbi.extensibility.utils.type;

    // powerbi.extensibility.utils.test
    import TestDataViewBuilder = powerbi.extensibility.utils.test.dataViewBuilder.TestDataViewBuilder;
    import getRandomNumbers = powerbi.extensibility.utils.test.helpers.getRandomNumbers;

    export class GlobeMapData extends TestDataViewBuilder {
        public static ColumnSource: string = "Category";
        public static ColumnValue: string = "Height";

        public valuesSourceDestination: string[] = [
            'Riyadh, Saudi Arabia',
            'New Taipei City, Republic of China',
            'Jakarta, Indonesia',
            'Casablanca, Morocco',
            'Shenzhen, China',
            'Addis Ababa, Ethiopia',
            'Cairo, Egypt',
            'Surat, India',
            'Tehran, Iran',
            'Lagos, Nigeria',
            'Jeddah, Saudi Arabia',
            'Cape Town, South Africa',
            'Shanghai, China',
            'Lima, Peru',
            'Durban, South Africa',
            'London, United Kingdom',
            'Ahmedabad, India',
            'Mexico City, Mexico',
            'Chennai, India'

        ];

        public valuesValue: number[] = getRandomNumbers(this.valuesSourceDestination.length, 10, 500);

        public getDataView(columnNames?: string[]): DataView {

            return this.createCategoricalDataViewBuilder([
                {
                    source: {
                        displayName: GlobeMapData.ColumnSource,
                        roles: { [GlobeMapData.ColumnSource]: true },
                        type: ValueType.fromDescriptor({ text: true })
                    },
                    values: this.valuesSourceDestination.map(x => x[0])
                }
            ], [
                {
                    source: {
                        displayName: GlobeMapData.ColumnValue,
                        roles: { [GlobeMapData.ColumnValue]: true },
                        isMeasure: true,
                        type: ValueType.fromDescriptor({ numeric: true }),
                    },
                    values: this.valuesValue
                }
            ], columnNames).build();
        }
    }
}
