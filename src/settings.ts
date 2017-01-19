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

module powerbi.extensibility.visual {
    import DataViewObjectsParser = powerbi.extensibility.utils.dataview.DataViewObjectsParser;

    export class GlobeMapSettings extends DataViewObjectsParser {
        //public lineoptions: LineSettings = new LineSettings();
        public dataPoint: DataPointSettings = new DataPointSettings();
        //public counteroptions: CounterSettings = new CounterSettings();
        //public misc: MiscSettings = new MiscSettings();
    }

    //export class LineSettings {
    //    public fill: string = "rgb(102, 212, 204)";
    //    public lineThickness: number = 3;
    //}

    export class DataPointSettings {
        public fill: string = "#005c55";
        //public dotSizeMin: number = 4;
        //public dotSizeMax: number = 38;
    }

    //export class CounterSettings {
    //    public counterTitle: string = "Total features";
    //}

    //export class MiscSettings {
    //    public isAnimated: boolean = true;
    //    public isStopped: boolean = true;
    //    public duration: number = 20;
    //}
}
