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
import VisualUpdateType = powerbi.VisualUpdateType;

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import { VisualBuilderBase, renderTimeout } from "powerbi-visuals-utils-testutils";
import { GlobeMap as VisualClass } from "../src/globemap";

export class GlobeMapBuilder extends VisualBuilderBase<VisualClass> {
    private static ChangeAllType: number = 62;
    constructor(width: number, height: number) {
        super(width, height, "GlobeMap1447669447625");
    }

    public update(dataView: DataView[] | DataView, updateType?: VisualUpdateType, formatMode?: boolean ): void {
        let options: VisualUpdateOptions = {
            dataViews: Array.isArray(dataView) ? dataView : [dataView],
            viewport: this.viewport,
            type: updateType!,
            formatMode: formatMode
        };

        this.visual.update(options);
    }

    public updateRenderTimeout(
        dataViews: DataView[] | DataView,
        fn: () => any,
        updateType: VisualUpdateType = GlobeMapBuilder.ChangeAllType,
        formatMode: boolean = false,
        timeout?: number): number {
        this.update(dataViews, updateType, formatMode);
        return renderTimeout(fn, timeout);
    }

    protected build(options: VisualConstructorOptions): VisualClass {
        return new VisualClass(options);
    }

    public get instance(): VisualClass {
        return this.visual;
    }

    public get canvasElement(): HTMLElement | null {
        return this.element.querySelector("canvas");
    }

    public get controlsElements(): NodeListOf<HTMLElement> | null {
        return this.element.querySelectorAll(".control");
    }

    public get rightControlElement(): HTMLElement | null {
        return this.element.querySelector(".control.js-control--move-right");
    }

    public get leftControlElement(): HTMLElement | null {
        return this.element.querySelector(".control.js-control--move-left");
    }

    public get upControlElement(): HTMLElement | null {
        return this.element.querySelector(".control.js-control--move-up");
    }

    public get downControlElement(): HTMLElement | null {
        return this.element.querySelector(".control.js-control--move-down");
    }

    public get zoomUpControlElement(): HTMLElement | null {
        return this.element.querySelector(".control.js-control--zoom-up");
    }

    public get zoomDownControlElement(): HTMLElement | null {
        return this.element.querySelector(".control.js-control--zoom-down");
    }
}
