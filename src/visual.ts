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

let WebGLHeatmap: any = window['WebGLHeatmap'];
let GlobeMapCanvasLayers: JQuery[];

module powerbi.extensibility.visual {
    import IGeocoder = powerbi.extensibility.geocoder.IGeocoder;
    import IGeocodeCoordinate = powerbi.extensibility.geocoder.IGeocodeCoordinate;
    import IPromise = powerbi.IPromise;
    import TouchRect = powerbi.extensibility.utils.svg.touch.Rectangle;
    import ILocation = powerbi.extensibility.geocoder.ILocation;
    import converterHelper = powerbi.extensibility.utils.dataview.converterHelper;
    import ColorHelper = powerbi.extensibility.utils.color.ColorHelper;

    import ClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.ClassAndSelector;
    import createClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.createClassAndSelector;
    import DataViewObjectPropertyTypeDescriptor = powerbi.DataViewPropertyValue;
    import SelectableDataPoint = powerbi.extensibility.utils.interactivity.SelectableDataPoint;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    import IMargin = powerbi.extensibility.utils.chart.axis.IMargin;
    import IInteractiveBehavior = powerbi.extensibility.utils.interactivity.IInteractiveBehavior;
    import ISelectionHandler = powerbi.extensibility.utils.interactivity.ISelectionHandler;
    import appendClearCatcher = powerbi.extensibility.utils.interactivity.appendClearCatcher;
    import createInteractivityService = powerbi.extensibility.utils.interactivity.createInteractivityService;
    import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import IAxisProperties = powerbi.extensibility.utils.chart.axis.IAxisProperties;
    import IVisualHost = powerbi.extensibility.visual.IVisualHost;
    import SVGUtil = powerbi.extensibility.utils.svg;
    import AxisHelper = powerbi.extensibility.utils.chart.axis;
    import TextMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import valueType = utils.type.ValueType;
    import DataViewObjectsParser = utils.dataview.DataViewObjectsParser;
    import IColorPalette = powerbi.extensibility.IColorPalette;

    interface ExtendedPromise<T> extends IPromise<T> {
        always(value: any): void;
    }

    export class GlobeMap implements IVisual {
        public static MercartorSphere: any;
        private static GlobeSettings = {
            autoRotate: false,
            earthRadius: 30,
            cameraRadius: 100,
            earthSegments: 100,
            heatmapSize: 1000,
            heatPointSize: 7,
            heatIntensity: 10,
            heatmapScaleOnZoom: 0.95,
            barWidth: 0.3,
            barHeight: 5,
            rotateSpeed: 0.5,
            zoomSpeed: 0.8,
            cameraAnimDuration: 1000, // ms
            clickInterval: 200 // ms
        };

        private layout: VisualLayout;
        private root: JQuery;
        private rendererContainer: JQuery;
        private rendererCanvas: HTMLElement;
        private camera: THREE.PerspectiveCamera;
        private renderer: THREE.WebGLRenderer;
        private scene: THREE.Scene;
        private orbitControls: THREE.OrbitControls;
        private earth: THREE.Mesh;
        private data: GlobeMapData;
        private get settings(): GlobeMapSettings {
            return this.data && this.data.settings;
        }
        private heatmap: any;
        private heatTexture: THREE.Texture;
        private mapTextures: THREE.Texture[];
        private barsGroup: THREE.Object3D;
        private readyToRender: boolean;
        private deferredRenderTimerId: any;
        private globeMapLocationCache: { [i: string]: ILocation };
        private locationsToLoad: number = 0;
        private locationsLoaded: number = 0;
        private renderLoopEnabled = true;
        private needsRender = false;
        private mousePosNormalized: any;
        private mousePos: any;
        private rayCaster: THREE.Raycaster;
        private selectedBar: any;
        private hoveredBar: any;
        private averageBarVector: THREE.Vector3;
        private zoomContainer: d3.Selection<any>;
        private zoomControl: d3.Selection<any>;
        private colors: IColorPalette;
        private animationFrameId: number;
        private cameraAnimationFrameId: number;
        private visualHost: IVisualHost;

        private tooltipService: ITooltipService;

        private static converter(dataView: DataView, colors: IColorPalette, visualHost: IVisualHost): GlobeMapData {
            let categorical: GlobeMapColumns<DataViewCategoryColumn & DataViewValueColumn[] & DataViewValueColumns> = GlobeMapColumns.getCategoricalColumns(dataView);
            if (!categorical || !categorical.Category || _.isEmpty(categorical.Category.values)
                || (_.isEmpty(categorical.Height) && _.isEmpty(categorical.Heat))) {
                return null;
            }

            let properties: GlobeMapSettings = GlobeMapSettings.getDefault() as GlobeMapSettings;
            let settings: GlobeMapSettings = GlobeMap.parseSettings(dataView);
            let groupedColumns: GlobeMapColumns<DataViewValueColumn>[] | any = GlobeMapColumns.getGroupedValueColumns(dataView);
            let dataPoints: any = [];
            let seriesDataPoints: any = [];
            let locations: any = [];
            let colorHelper: ColorHelper = new ColorHelper(colors, null, properties.dataPoint.fill);

            let locationType: any, heights: any, heightsBySeries: any, toolTipDataBySeries: any, heats: any;

            if (categorical.Category && categorical.Category.values) {
                locations = categorical.Category.values;
                let type: any = <any>categorical.Category.source.type;
                locationType = type.category ? (<string>type.category).toLowerCase() : "";
            } else {
                locations = [];
            }

            if (!_.isEmpty(categorical.Height)) {
                if (groupedColumns.length > 1) {
                    heights = new Array(locations.length);
                    heightsBySeries = new Array(locations.length);
                    toolTipDataBySeries = new Array(locations.length);
                    seriesDataPoints = new Array(groupedColumns.length);
                    // creating a matrix for drawing values by series later.
                    for (let i: number = 0; i < groupedColumns.length; i++) {
                        let values: any = groupedColumns[i].Height.values;
                        seriesDataPoints[i] = GlobeMap.createDataPointForEnumeration(
                            dataView, groupedColumns[i].Height.source, i, null, colorHelper, colors, visualHost);
                        seriesDataPoints[i].color = settings.dataPoint.fill;
                        for (let j: number = 0; j < values.length; j++) {
                            if (!heights[j]) heights[j] = 0;
                            heights[j] += values[j] ? values[j] : 0;
                            if (!heightsBySeries[j]) heightsBySeries[j] = [];
                            heightsBySeries[j][i] = values[j];
                            if (!toolTipDataBySeries[j]) toolTipDataBySeries[j] = [];
                            toolTipDataBySeries[j][i] = {
                                displayName: categorical.Series && categorical.Series.source.displayName,
                                value: dataView.categorical.values.grouped()[i].name,
                                dataPointValue: values[j]
                            };
                        }
                    }
                    for (let i: number = 0; i < groupedColumns.length; i++) {
                        let values: any = groupedColumns[i].Height.values;
                        for (let j: number = 0; j < values.length; j++) {
                            // calculating relative size of series
                            heightsBySeries[j][i] = <number>values[j] / heights[j];
                        }
                    }
                } else {
                    heights = categorical.Height[0].values;
                    heightsBySeries = new Array(groupedColumns.length);
                    seriesDataPoints[0] = GlobeMap.createDataPointForEnumeration(
                        dataView, groupedColumns[0].Height.source, 0, dataView.metadata, colorHelper, colors, visualHost);
                    seriesDataPoints[0].color = settings.dataPoint.fill;
                }
            } else {
                heightsBySeries = new Array(locations.length);
                heights = new Array(locations.length);
            }

            if (!_.isEmpty(categorical.Heat)) {
                if (groupedColumns.length > 1) {
                    heats = new Array(locations.length);
                    for (let i: number = 0; i < groupedColumns.length; i++) {
                        let values: any = groupedColumns[i].Heat.values;
                        for (let j = 0; j < values.length; j++) {
                            if (!heats[j]) heats[j] = 0;
                            heats[j] += values[j] ? values[j] : 0;
                        }
                    }
                } else {
                    heats = categorical.Heat[0].values;
                }

            } else {
                heats = new Array(locations.length);
            }

            let maxHeight: any = Math.max.apply(null, heights) || 1;
            let maxHeat: any = Math.max.apply(null, heats) || 1;
            let heatFormatter: IValueFormatter = valueFormatter.create({
                format: !_.isEmpty(categorical.Heat) && categorical.Heat[0].source.format,
                value: heats[0],
                value2: heats[1]
            });
            let heightFormatter = valueFormatter.create({
                format: !_.isEmpty(categorical.Height) && categorical.Height[0].source.format,
                value: heights[0],
                value2: heights[1]
            });

            for (let i: number = 0, len = locations.length; i < len; ++i) {
                if (typeof (locations[i]) === "string") {
                    let place: any = locations[i].toLowerCase();
                    let placeKey: string = place + "/" + locationType;
                    let location: ILocation = (!_.isEmpty(categorical.X) && !_.isEmpty(categorical.Y))
                        ? { longitude: <number>categorical.X[0].values[i] || 0, latitude: <number>categorical.Y[0].values[i] || 0 }
                        : undefined;

                    let height: number = heights[i] / maxHeight;
                    let heat: number = heats[i] / maxHeat;

                    let renderDatum: GlobeMapDataPoint = {
                        location: location,
                        placeKey: placeKey,
                        place: place,
                        locationType: locationType,
                        height: height ? height || 0.01 : undefined,
                        heightBySeries: heightsBySeries[i],
                        seriesToolTipData: toolTipDataBySeries ? toolTipDataBySeries[i] : undefined,
                        heat: heat || 0,
                        toolTipData: {
                            location: { displayName: categorical.Category && categorical.Category.source.displayName, value: locations[i] },
                            height: { displayName: !_.isEmpty(categorical.Height) && categorical.Height[0].source.displayName, value: heightFormatter.format(heights[i]) },
                            heat: { displayName: !_.isEmpty(categorical.Heat) && categorical.Heat[0].source.displayName, value: heatFormatter.format(heats[i]) }
                        }
                    };

                    dataPoints.push(renderDatum);
                }
            }

            return {
                dataView: dataView,
                dataPoints: dataPoints,
                seriesDataPoints: seriesDataPoints,
                settings: settings
            };
        }

        private static parseSettings(dataView: DataView): GlobeMapSettings {
            let settings: GlobeMapSettings = GlobeMapSettings.parse(dataView) as GlobeMapSettings;
            return settings;
        }

        private static createDataPointForEnumeration(
            dataView: DataView,
            source: DataViewMetadataColumn,
            seriesIndex,
            metaData,
            colorHelper: ColorHelper,
            colors: IColorPalette,
            visualHost: IVisualHost
        ): GlobeMapSeriesDataPoint {

            let columns = dataView.categorical.values.grouped()[seriesIndex];
            let values: DataViewValueColumns = <DataViewValueColumns>columns.values;
            let sourceForFormat: DataViewMetadataColumn = source;
            let nameForFormat: PrimitiveValue = source.displayName;
            if (source.groupName !== undefined) {
                sourceForFormat = values.source;
                nameForFormat = source.groupName;
            }

            let label: string = valueFormatter.format(nameForFormat, valueFormatter.getFormatString(sourceForFormat, null));

            let selector: ISelectionId = visualHost.createSelectionIdBuilder().createSelectionId();

            const categoryColumn: DataViewCategoryColumn = {
                source: values[seriesIndex].source,
                values: null,
                identity: [values[seriesIndex].identity]
            };

            let identity: ISelectionId = visualHost.createSelectionIdBuilder()
                .withCategory(categoryColumn, 0)
                .withMeasure(values[seriesIndex].source.queryName)
                .createSelectionId();

            let category: any = <string>converterHelper.getSeriesName(source);
            let objects: any = <any>columns.objects;
            let color: string = objects && objects.dataPoint ? objects.dataPoint.fill.solid.color : metaData && metaData.objects
                ? colorHelper.getColorForMeasure(metaData.objects, "")
                : colors.getColor(seriesIndex).value;
            return {
                label: label,
                identity: identity,
                category: category,
                color: color,
                selected: null
            };
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            let instances: VisualObjectInstance[] | VisualObjectInstanceEnumerationObject = GlobeMapSettings.enumerateObjectInstances(this.settings || GlobeMapSettings.getDefault(), options);
            return instances;
        }

        constructor(options: VisualConstructorOptions) {
            this.root = $("<div>").appendTo(options.element)
                .attr('drag-resize-disabled', "true")
                .css({
                    'position': "absolute"
                });

            this.visualHost = options.host;
            this.tooltipService = this.visualHost.tooltipService;

            this.layout = new VisualLayout();
            this.readyToRender = false;

            if (!this.globeMapLocationCache) {
                this.globeMapLocationCache = {};
            }

            this.colors = options.host.colorPalette;

            if ((<any>window).THREE) {
                this.setup();
            }
        }

        private setup(): void {
            this.initTextures();
            this.initMercartorSphere();
            this.initZoomControl();
            this.initScene();
            this.initHeatmap();
            this.readyToRender = true;
            this.initRayCaster();
        }

        private initScene(): void {
            this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
            this.rendererContainer = $("<div>").appendTo(this.root).css({
                'width': "100%",
                'height': "100%",
                'position': "relative"
            });

            this.rendererContainer.append(this.renderer.domElement);
            this.rendererCanvas = this.renderer.domElement;
            this.camera = new THREE.PerspectiveCamera(35, this.layout.viewportIn.width / this.layout.viewportIn.height, 0.1, 10000);
            this.orbitControls = new THREE.OrbitControls(this.camera, this.rendererCanvas);
            this.orbitControls.enablePan = false;
            this.scene = new THREE.Scene();

            this.renderer.setSize(this.layout.viewportIn.width, this.layout.viewportIn.height);
            this.renderer.setClearColor(0xbac4d2, 1);
            this.camera.position.z = GlobeMap.GlobeSettings.cameraRadius;

            this.orbitControls.maxDistance = GlobeMap.GlobeSettings.cameraRadius;
            this.orbitControls.minDistance = GlobeMap.GlobeSettings.earthRadius + 1;
            this.orbitControls.rotateSpeed = GlobeMap.GlobeSettings.rotateSpeed;
            this.orbitControls.zoomSpeed = GlobeMap.GlobeSettings.zoomSpeed;
            this.orbitControls.autoRotate = GlobeMap.GlobeSettings.autoRotate;

            let ambientLight: THREE.AmbientLight = new THREE.AmbientLight(0x000000);
            let light1: THREE.DirectionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
            let light2: THREE.DirectionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
            let earth: THREE.Mesh = this.earth = this.createEarth();

            this.scene.add(ambientLight);
            this.scene.add(light1);
            this.scene.add(light2);
            this.scene.add(earth);

            light1.position.set(20, 20, 20);
            light2.position.set(0, 0, -20);

            let render: any = () => {
                try {
                    if (this.renderLoopEnabled) {
                        this.animationFrameId = requestAnimationFrame(render);
                    }
                    if (!this.shouldRender()) return;
                    this.orbitControls.update();
                    this.setEarthTexture();
                    if (this.heatmap && this.heatmap.display) {
                        this.heatmap.display(); // Needed for IE/Edge to behave nicely
                    }
                    this.renderer.render(this.scene, this.camera);
                    this.intersectBars();
                    this.needsRender = false;
                } catch (e) {
                    console.error(e);
                }
            };

            this.animationFrameId = requestAnimationFrame(render);
        }

        private shouldRender(): boolean {
            return this.readyToRender && this.needsRender;
        }

        private createEarth(): THREE.Mesh {
            let geometry: any = new GlobeMap.MercartorSphere(
                GlobeMap.GlobeSettings.earthRadius,
                GlobeMap.GlobeSettings.earthSegments,
                GlobeMap.GlobeSettings.earthSegments);
            let material: THREE.MeshPhongMaterial = new THREE.MeshPhongMaterial({
                map: this.mapTextures[0],
                side: THREE.DoubleSide,
                shading: THREE.SmoothShading,
                shininess: 1
            });

            let mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
            mesh.add(new THREE.AmbientLight(0xaaaaaa, 1));

            return mesh;
        }

        public zoomClicked(zoomDirection: any): void {
            if (this.orbitControls.enabled === false)
                return;

            if (zoomDirection === -1) {
                this.orbitControls.dollyOut(Math.pow(0.95, GlobeMap.GlobeSettings.zoomSpeed));
            } else if (zoomDirection === 1) {
                this.orbitControls.dollyIn(Math.pow(0.95, GlobeMap.GlobeSettings.zoomSpeed));
            }

            this.orbitControls.update();
            this.animateCamera(this.camera.position);
        }

        public rotateCam(deltaX: number, deltaY: number) {
            if (!this.orbitControls.enabled) {
                return;
            }

            this.orbitControls.rotateLeft(2 * Math.PI * deltaX / this.rendererCanvas.offsetHeight * GlobeMap.GlobeSettings.rotateSpeed);
            this.orbitControls.rotateUp(2 * Math.PI * deltaY / this.rendererCanvas.offsetHeight * GlobeMap.GlobeSettings.rotateSpeed);
            this.orbitControls.update();
            this.animateCamera(this.camera.position);
        }

        private initTextures() {
            if (!GlobeMapCanvasLayers) {
                // Initialize once, since this is a CPU + Network heavy operation.
                GlobeMapCanvasLayers = [];

                for (let level: number = 2; level <= 5; ++level) {
                    let canvas: JQuery = this.getBingMapCanvas(level);
                    GlobeMapCanvasLayers.push(canvas);
                }
            }

            // Can't execute in for loop because variable assignement gets overwritten
            let createTexture: (canvas: JQuery) => THREE.Texture = (canvas: JQuery) => {
                let texture: THREE.Texture = new THREE.Texture(<HTMLCanvasElement>canvas.get(0));
                texture.needsUpdate = true;
                canvas.on("ready", (e, resolution) => {
                    texture.needsUpdate = true;
                    this.needsRender = true;
                });
                return texture;

            };

            this.mapTextures = [];
            for (let i: number = 0; i < GlobeMapCanvasLayers.length; ++i) {
                this.mapTextures.push(createTexture(GlobeMapCanvasLayers[i]));
            }
        }

        private initHeatmap() {
            let heatmap: any;
            try {
                heatmap = this.heatmap = new WebGLHeatmap({ width: GlobeMap.GlobeSettings.heatmapSize, height: GlobeMap.GlobeSettings.heatmapSize, intensityToAlpha: true });
            } catch (e) {
                // IE & Edge will throw an error about texImage2D, we need to ignore it
                console.error(e);
            }

            // canvas contents will be used for a texture
            let texture: THREE.Texture = this.heatTexture = new THREE.Texture(heatmap.canvas);
            texture.needsUpdate = true;

            let material: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
            let geometry: THREE.SphereGeometry = new THREE.SphereGeometry(GlobeMap.GlobeSettings.earthRadius + 0.01, GlobeMap.GlobeSettings.earthSegments, GlobeMap.GlobeSettings.earthSegments);
            let mesh: THREE.Mesh = new THREE.Mesh(geometry, material);

            window["heatmap"] = heatmap;
            window["heatmapTexture"] = texture;

            this.scene.add(mesh);
        }

        private setEarthTexture(): void {
            // get distance as arbitrary value from 0-1
            if (!this.camera) return;
            let maxDistance: number = GlobeMap.GlobeSettings.cameraRadius - GlobeMap.GlobeSettings.earthRadius;
            let distance: number = (this.camera.position.length() - GlobeMap.GlobeSettings.earthRadius) / maxDistance;

            let texture: THREE.Texture;
            if (distance <= 1 / 5) {
                texture = this.mapTextures[3];
            } else if (distance <= 2 / 5) {
                texture = this.mapTextures[2];
            } else if (distance <= 3 / 5) {
                texture = this.mapTextures[1];
            } else {
                texture = this.mapTextures[0];
            }

            if ((<any>this.earth.material).map !== texture) {
                (<any>this.earth.material).map = texture;
            }

            if (this.selectedBar) {
                this.orbitControls.rotateSpeed = GlobeMap.GlobeSettings.rotateSpeed;
            } else {
                this.orbitControls.rotateSpeed = GlobeMap.GlobeSettings.rotateSpeed * distance;
            }
        }

        public update(options: VisualUpdateOptions): void {
            this.layout.viewport = options.viewport;
            this.root.css(this.layout.viewportIn);
            this.zoomContainer.style({
                'padding-left': (this.layout.viewportIn.width - parseFloat(this.zoomControl.attr("width")) + 6) + "px", // Fix for chrome
                'display': this.layout.viewportIn.height > $(this.zoomContainer.node()).height()
                    && this.layout.viewportIn.width > $(this.zoomContainer.node()).width()
                    ? null : 'none'
            });

            if (this.layout.viewportChanged) {
                if (this.camera && this.renderer) {
                    this.camera.aspect = this.layout.viewportIn.width / this.layout.viewportIn.height;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(this.layout.viewportIn.width, this.layout.viewportIn.height);
                    this.renderer.render(this.scene, this.camera);
                }
            }

            if (options.type === VisualUpdateType.Data || options.type === VisualUpdateType.All) {
                this.cleanHeatAndBar();
                let data: GlobeMapData = GlobeMap.converter(options.dataViews[0], this.colors, this.visualHost);
                if (data) {
                    this.data = data;
                    this.renderMagic();
                }
            }
        }

        public cleanHeatAndBar(): void {
            this.heatmap.clear();
            this.heatTexture.needsUpdate = true;
            if (this.barsGroup) {
                this.scene.remove(this.barsGroup);
            }
        }

        private renderMagic(): void {
            if (!this.data) {
                return;
            }

            this.data.dataPoints.forEach(d => this.geocodeRenderDatum(d));
            this.data.dataPoints.forEach(d => d.location = d.location || this.globeMapLocationCache[d.placeKey]);

            if (!this.readyToRender) {
                this.defferedRender();
                return;
            }

            this.heatmap.clear();

            if (this.barsGroup) {
                this.scene.remove(this.barsGroup);
            }

            this.barsGroup = new THREE.Object3D();
            this.scene.add(this.barsGroup);

            this.averageBarVector = new THREE.Vector3();

            for (let i: number = 0, len = this.data.dataPoints.length; i < len; ++i) {
                let renderDatum: GlobeMapDataPoint = this.data.dataPoints[i];

                if (!renderDatum.location || renderDatum.location.longitude === undefined || renderDatum.location.latitude === undefined) {
                    continue;
                }

                if (renderDatum.heat > 0.001) {
                    if (renderDatum.heat < 0.1) renderDatum.heat = 0.1;
                    let x: number = (180 + renderDatum.location.longitude) / 360 * GlobeMap.GlobeSettings.heatmapSize;
                    let y: number = (1 - ((90 + renderDatum.location.latitude) / 180)) * GlobeMap.GlobeSettings.heatmapSize;
                    this.heatmap.addPoint(x, y, GlobeMap.GlobeSettings.heatPointSize, renderDatum.heat * GlobeMap.GlobeSettings.heatIntensity);
                }

                if (renderDatum.height >= 0) {
                    if (renderDatum.height < 0.01) renderDatum.height = 0.01;
                    let latRadians: number = renderDatum.location.latitude / 180 * Math.PI; // radians
                    let lngRadians: number = renderDatum.location.longitude / 180 * Math.PI;

                    let x: number = Math.cos(lngRadians) * Math.cos(latRadians);
                    let z: number = -Math.sin(lngRadians) * Math.cos(latRadians);
                    let y: number = Math.sin(latRadians);
                    let vector: THREE.Vector3 = new THREE.Vector3(x, y, z);

                    this.averageBarVector.add(vector);

                    let barHeight: number = GlobeMap.GlobeSettings.barHeight * renderDatum.height;
                    // this array holds the relative series values to the actual measure for example [0.2,0.3,0.5]
                    // this is how we draw the vectors relativly to the complete value one on top of another. 
                    let measuresBySeries = [];
                    // this array holds the original values of the series for the tool tips
                    let dataPointToolTip = [];
                    if (renderDatum.heightBySeries) {
                        for (let c: number = 0; c < renderDatum.heightBySeries.length; c++) {
                            if (renderDatum.heightBySeries[c]) {
                                measuresBySeries.push(renderDatum.heightBySeries[c]);
                            }
                            dataPointToolTip.push(renderDatum.seriesToolTipData[c]);
                        }
                    } else {
                        // no category series so we'll just draw one value
                        measuresBySeries.push(1);
                    }

                    let previousMeasureValue = 0;
                    for (let j: number = 0; j < measuresBySeries.length; j++) {
                        previousMeasureValue += measuresBySeries[j];
                        let geometry: THREE.BoxGeometry = new THREE.BoxGeometry(GlobeMap.GlobeSettings.barWidth, GlobeMap.GlobeSettings.barWidth, barHeight * measuresBySeries[j]);
                        let bar: THREE.Mesh = new THREE.Mesh(geometry, this.getBarMaterialByIndex(j));
                        let position: THREE.Vector3 = vector.clone().multiplyScalar(GlobeMap.GlobeSettings.earthRadius + ((barHeight / 2) * previousMeasureValue));
                        bar.position.set(position.x, position.y, position.z);
                        bar.lookAt(vector);
                        (<any>bar).toolTipData = dataPointToolTip.length === 0
                            ? renderDatum.toolTipData
                            : this.getToolTipDataForSeries(renderDatum.toolTipData, dataPointToolTip[j]);

                        this.barsGroup.add(bar);

                        previousMeasureValue += measuresBySeries[j];
                    }
                }
            }

            if (this.barsGroup.children.length > 0 && this.camera) {
                this.averageBarVector.multiplyScalar(1 / this.barsGroup.children.length);
                if (this.locationsLoaded === this.locationsToLoad) {
                    this.animateCamera(this.averageBarVector);
                }
            }

            this.heatmap.update();
            this.heatmap.blur();
            this.heatTexture.needsUpdate = true;
            this.needsRender = true;
        }

        private getBarMaterialByIndex(index): THREE.MeshPhongMaterial {
            return new THREE.MeshPhongMaterial({ color: this.data.seriesDataPoints[index].color });
        }

        private getToolTipDataForSeries(toolTipData, dataPointToolTip): any {
            let result: any = jQuery.extend(true, {
                series: { displayName: dataPointToolTip.displayName, value: dataPointToolTip.value }
            }, toolTipData);
            result.height.value = dataPointToolTip.dataPointValue;
            return result;
        }

        private geocodeRenderDatum(renderDatum: GlobeMapDataPoint) {
            if (renderDatum.location || this.globeMapLocationCache[renderDatum.placeKey]) {
                return;
            }

            let location: ILocation = <any>{},
                geocoder: IGeocoder;

            this.globeMapLocationCache[renderDatum.placeKey] = location; // store empty object so we don't send AJAX request again
            this.locationsToLoad++;

            geocoder = powerbi.extensibility.geocoder.createGeocoder();

            if (geocoder) {
                (geocoder.geocode(
                    renderDatum.place,
                    renderDatum.locationType) as ExtendedPromise<IGeocodeCoordinate>).always((l: ILocation) => {
                        // we use always because we want to cache unknown values. 
                        // No point asking bing again and again when it tells us it doesn't know about a location
                        if (l) {
                            location.latitude = l.latitude;
                            location.longitude = l.longitude;
                        }

                        this.locationsLoaded++;

                        this.defferedRender();
                    });
            }
        }

        private defferedRender() {
            if (!this.deferredRenderTimerId) {
                this.deferredRenderTimerId = setTimeout(() => {
                    this.deferredRenderTimerId = null;
                    this.renderMagic();
                }, 500);
            }
        }

        private initRayCaster() {
            this.rayCaster = new THREE.Raycaster();

            let element: HTMLElement = this.root.get(0);
            let mouseDownTime: number;
            let elementStyle: CSSStyleDeclaration = window.getComputedStyle(element);

            $(this.rendererCanvas).on("mousemove", (event) => {
                let elementViewHeight: number = element.offsetHeight - element.offsetTop
                    - parseFloat(elementStyle.paddingTop)
                    - parseFloat(elementStyle.paddingBottom);

                let elementViewWidth: number = element.offsetWidth - element.offsetLeft
                    - parseFloat(elementStyle.paddingLeft)
                    - parseFloat(elementStyle.paddingRight);

                let fractionalPositionX: number = event.offsetX / elementViewWidth;
                let fractionalPositionY: number = event.offsetY / elementViewHeight;

                this.mousePos = new THREE.Vector2(event.clientX, event.clientY);

                // get coordinates in -1 to +1 space
                this.mousePosNormalized = new THREE.Vector2(fractionalPositionX * 2 - 1, -fractionalPositionY * 2 + 1);

                this.needsRender = true;
            }).on("mousedown", (event) => {
                cancelAnimationFrame(this.cameraAnimationFrameId);
                mouseDownTime = Date.now();
            }).on("mouseup", (event) => {

                // Debounce slow clicks
                if ((Date.now() - mouseDownTime) > GlobeMap.GlobeSettings.clickInterval) {
                    return;
                }

                if (this.hoveredBar && event.shiftKey) {
                    this.selectedBar = this.hoveredBar;
                    this.animateCamera(this.selectedBar.position, () => {
                        if (!this.selectedBar) return;
                        this.orbitControls.target.copy(this.selectedBar.position.clone().normalize().multiplyScalar(GlobeMap.GlobeSettings.earthRadius));
                        this.orbitControls.minDistance = 1;
                    });
                } else {
                    if (this.selectedBar) {
                        this.animateCamera(this.selectedBar.position, () => {
                            this.orbitControls.target.set(0, 0, 0);
                            this.orbitControls.minDistance = GlobeMap.GlobeSettings.earthRadius + 1;
                        });
                        this.selectedBar = null;
                    }
                }
            }).on("mousewheel DOMMouseScroll", (e: any) => {
                this.needsRender = true;
                if (this.orbitControls.enabled && this.orbitControls.enableZoom) {
                    cancelAnimationFrame(this.cameraAnimationFrameId);
                    this.heatTexture.needsUpdate = true;
                    e = e.originalEvent;
                    let delta: number = e.wheelDelta > 0 || e.detail < 0 ? 1 : -1;
                    let scale: number = delta > 0 ? GlobeMap.GlobeSettings.heatmapScaleOnZoom : (1 / GlobeMap.GlobeSettings.heatmapScaleOnZoom);
                    this.heatmap.multiply(scale);
                    this.heatmap.update();
                }
            });
        }

        private intersectBars() {
            if (!this.rayCaster
                || !this.barsGroup
                || !this.mousePosNormalized
                || !this.mousePos) {

                return;
            }

            let rayCaster: THREE.Raycaster = this.rayCaster;

            rayCaster.setFromCamera(this.mousePosNormalized, this.camera);
            let intersects: THREE.Intersection[] = rayCaster.intersectObjects(this.barsGroup.children);

            if (intersects && intersects.length > 0) {
                let object: THREE.Object3D = intersects[0].object;

                if (!object || !(<any>object).toolTipData) {
                    return;
                }

                let toolTipData: any = (<any>object).toolTipData;
                let toolTipItems: VisualTooltipDataItem[] = [];

                if (toolTipData.location.displayName) {
                    toolTipItems.push(toolTipData.location);
                }

                if (toolTipData.series) {
                    toolTipItems.push(toolTipData.series);
                }

                if (toolTipData.height.displayName) {
                    toolTipItems.push(toolTipData.height);
                }

                if (toolTipData.heat.displayName) {
                    toolTipItems.push(toolTipData.heat);
                }

                this.hoveredBar = object;

                const tooltipShowOptions: TooltipShowOptions = {
                    coordinates: [
                        this.mousePos.x,
                        this.mousePos.y
                    ],
                    isTouchEvent: false,
                    dataItems: toolTipItems,
                    identities: []
                };

                this.visualHost.tooltipService.show(tooltipShowOptions);
            } else {
                this.hoveredBar = null;
                let hideOp: TooltipHideOptions = {
                    immediately: false,
                    isTouchEvent: false
                };
                this.hideTooltip();
            }
        }

        private hideTooltip(): void {
            const tooltipHideOptions: TooltipHideOptions = {
                immediately: true,
                isTouchEvent: false
            };

            this.tooltipService.hide(tooltipHideOptions);
        }

        private animateCamera(to: THREE.Vector3, done?: Function) {
            this.hideTooltip();

            if (!this.camera) return;
            cancelAnimationFrame(this.cameraAnimationFrameId);
            let startTime: number = Date.now();
            let duration: number = GlobeMap.GlobeSettings.cameraAnimDuration;
            let endTime: number = startTime + duration;
            let startPos: THREE.Vector3 = this.camera.position.clone().normalize();
            let endPos: THREE.Vector3 = to.clone().normalize();
            let length: number = this.camera.position.length();

            let easeInOut = (t) => {
                t *= 2;
                if (t < 1) return (t * t * t) / 2;
                t -= 2;
                return (t * t * t + 2) / 2;
            };

            let onUpdate: any = () => {
                let now: number = Date.now();
                let t: number = (now - startTime) / duration;
                if (t > 1) t = 1;
                t = easeInOut(t);

                let pos: THREE.Vector3 = new THREE.Vector3()
                    .add(startPos.clone().multiplyScalar(1 - t))
                    .add(endPos.clone().multiplyScalar(t))
                    .normalize()
                    .multiplyScalar(length);

                this.camera.position.set(pos.x, pos.y, pos.z);

                if (now < endTime) {
                    this.cameraAnimationFrameId = requestAnimationFrame(onUpdate);
                } else if (done) {
                    done();
                }

                this.needsRender = true;
            };

            this.cameraAnimationFrameId = requestAnimationFrame(onUpdate);
        }

        public destroy() {
            cancelAnimationFrame(this.animationFrameId);
            cancelAnimationFrame(this.cameraAnimationFrameId);
            clearTimeout(this.deferredRenderTimerId);
            this.renderLoopEnabled = false;
            this.scene = null;
            this.heatmap = null;
            this.heatTexture = null;
            this.camera = null;
            if (this.renderer) {
                if (this.renderer.context) {
                    let extension: any = this.renderer.context.getExtension('WEBGL_lose_context');
                    if (extension)
                        extension.loseContext();
                    this.renderer.context = null;
                }
                this.renderer.domElement = null;
            }
            this.renderer = null;
            this.data = null;
            this.barsGroup = null;
            if (this.orbitControls) {
                this.orbitControls.dispose();
            }

            this.orbitControls = null;
            if (this.rendererCanvas) {
                $(this.rendererCanvas)
                    .off("mousemove mouseup mousedown mousewheel DOMMouseScroll");
            }

            this.rendererCanvas = null;

            if (this.root) {
                this.root.empty();
            }

            this.hideTooltip();
        }

        private initZoomControl() {
            let radius: number = 17;
            let zoomControlWidth: number = radius * 8.5;
            let zoomControlHeight: number = radius * 8.5;
            let startX: number = radius * 3;
            let startY: number = radius + 3;
            let gap: number = radius * 2;

            this.zoomContainer = d3.select(this.root[0])
                .append('div')
                .style({
                    'position': "absolute",
                    'bottom': "-5px",
                    'z-index': "1000",
                    'pointer-events': "none"
                });

            this.zoomControl = this.zoomContainer.append("svg").attr({
                'width': zoomControlWidth,
                'height': zoomControlHeight,
                'pointer-events': "all"
            });

            let bottom: d3.Selection<any> = this.zoomControl.append("g").on("mousedown", () => onMouseDown(() => this.rotateCam(0, -5)));
            bottom.append("circle").attr({ cx: startX + gap, cy: startY + (2 * gap), r: radius, fill: "white", opacity: 0.5, stroke: 'gray' });
            bottom.append("path").attr({ d: "M" + (startX + (2 * radius)) + " " + (startY + (radius * 4.7)) + " l12 -20 a40,70 0 0,1 -24,0z", fill: "gray" });

            let left: d3.Selection<any> = this.zoomControl.append("g").on("mousedown", () => onMouseDown(() => this.rotateCam(5, 0)));
            left.append("circle").attr({ cx: startX, cy: startY + gap, r: radius, fill: "white", stroke: "gray", opacity: 0.5 });
            left.append("path").attr({ d: "M" + (startX - radius / 1.5) + " " + (startY + (radius * 2)) + " l20 -12 a70,40 0 0,0 0,24z", fill: "gray" });

            let top: d3.Selection<any> = this.zoomControl.append("g").on("mousedown", () => onMouseDown(() => this.rotateCam(0, 5)));
            top.append("circle").attr({ cx: startX + gap, cy: startY, r: radius, fill: "white", stroke: "gray", opacity: 0.5 });
            top.append("path").attr({ d: "M" + (startX + (2 * radius)) + " " + (startY - (radius / 1.5)) + " l12 20 a40,70 0 0,0 -24,0z", fill: "gray" });

            let right: d3.Selection<any> = this.zoomControl.append("g").on("mousedown", () => onMouseDown(() => this.rotateCam(-5, 0)));
            right.append("circle").attr({ cx: startX + (2 * gap), cy: startY + gap, r: radius, fill: "white", stroke: "gray", opacity: 0.5 });
            right.append("path").attr({ d: "M" + (startX + (4.7 * radius)) + " " + (startY + (radius * 2)) + " l-20 -12 a70,40 0 0,1 0,24z", fill: "gray" });

            let zoomIn: d3.Selection<any> = this.zoomControl.append("g").on("mousedown", () => onMouseDown(() => this.zoomClicked(-1)));
            zoomIn.append("circle").attr({ cx: startX + 4 * radius, cy: startY + 6 * radius, r: radius, fill: "white", stroke: "gray", opacity: 0.5 });
            zoomIn.append("rect").attr({ x: startX + 3.5 * radius, y: startY + 5.9 * radius, width: radius, height: radius / 3, fill: "gray" });
            zoomIn.append("rect").attr({ x: startX + (4 * radius) - radius / 6, y: startY + 5.55 * radius, width: radius / 3, height: radius, fill: "gray" });

            let zoomOut: d3.Selection<any> = this.zoomControl.append("g").on("mousedown", () => onMouseDown(() => this.zoomClicked(1)));
            zoomOut.append("circle").attr({ cx: startX, cy: startY + 6 * radius, r: radius, fill: "white", stroke: "gray", opacity: "0.50" });
            zoomOut.append("rect").attr({ x: startX - (radius / 2), y: startY + 5.9 * radius, width: radius, height: radius / 3, fill: "gray" });

            function onMouseDown(callback: () => void) {
                (d3.event as MouseEvent).stopPropagation();
                if ((<any>d3.event).button === 0) {
                    callback();
                }
            }
        }

        private initMercartorSphere() {
            if (GlobeMap.MercartorSphere) return;

            let MercartorSphere: any = function (radius: number, widthSegments: number, heightSegments: number): void {
                THREE.Geometry.call(this);

                this.radius = radius;
                this.widthSegments = widthSegments;
                this.heightSegments = heightSegments;

                this.t = 0;

                let x: number, y: number, vertices = [], uvs = [];

                function interplolate(a, b, t) {
                    return (1 - t) * a + t * b;
                }

                // interpolates between sphere and plane
                function interpolateVertex(u, v, t) {
                    let maxLng: number = Math.PI * 2;
                    let maxLat: number = Math.PI;
                    let radius: number = this.radius;

                    let sphereX: number = - radius * Math.cos(u * maxLng) * Math.sin(v * maxLat);
                    let sphereY: number = - radius * Math.cos(v * maxLat);
                    let sphereZ: number = radius * Math.sin(u * maxLng) * Math.sin(v * maxLat);

                    let planeX: number = u * radius * 2 - radius;
                    let planeY: number = v * radius * 2 - radius;
                    let planeZ: number = 0;

                    let x: number = interplolate(sphereX, planeX, t);
                    let y: number = interplolate(sphereY, planeY, t);
                    let z: number = interplolate(sphereZ, planeZ, t);

                    return new THREE.Vector3(x, y, z);
                }

                // http://mathworld.wolfram.com/MercatorProjection.html
                // Mercator projection goes form +85.05 to -85.05 degrees
                function interpolateUV(u, v, t) {
                    let lat: number = (v - 0.5) * 89.99 * 2 / 180 * Math.PI; // turn from 0-1 into lat in radians
                    let sin: number = Math.sin(lat);
                    let normalizedV: number = 0.5 + 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;
                    return new THREE.Vector2(u, normalizedV); // interplolate(normalizedV1, v, t))
                }

                for (y = 0; y <= heightSegments; y++) {

                    let verticesRow: any = [];
                    let uvsRow: any = [];

                    for (x = 0; x <= widthSegments; x++) {

                        let u: number = x / widthSegments;
                        let v: number = y / heightSegments;

                        this.vertices.push(interpolateVertex.call(this, u, v, this.t));
                        uvsRow.push(interpolateUV.call(this, u, v, this.t));
                        verticesRow.push(this.vertices.length - 1);
                    }

                    vertices.push(verticesRow);
                    uvs.push(uvsRow);

                }

                for (y = 0; y < this.heightSegments; y++) {

                    for (x = 0; x < this.widthSegments; x++) {

                        let v1: any = vertices[y][x + 1];
                        let v2: any = vertices[y][x];
                        let v3: any = vertices[y + 1][x];
                        let v4: any = vertices[y + 1][x + 1];

                        let n1: any = this.vertices[v1].clone().normalize();
                        let n2: any = this.vertices[v2].clone().normalize();
                        let n3: any = this.vertices[v3].clone().normalize();
                        let n4: any = this.vertices[v4].clone().normalize();

                        let uv1: any = uvs[y][x + 1];
                        let uv2: any = uvs[y][x];
                        let uv3: any = uvs[y + 1][x];
                        let uv4: any = uvs[y + 1][x + 1];

                        this.faces.push(new THREE.Face3(v1, v2, v3, [n1, n2, n3]));
                        this.faces.push(new THREE.Face3(v1, v3, v4, [n1, n3, n4]));

                        this.faceVertexUvs[0].push([uv1.clone(), uv2.clone(), uv3.clone()]);
                        this.faceVertexUvs[0].push([uv1.clone(), uv3.clone(), uv4.clone()]);
                    }
                }

                this.computeFaceNormals();
                this.computeVertexNormals();
                this.computeBoundingSphere();
            };

            MercartorSphere.prototype = Object.create(THREE.Geometry.prototype);
            GlobeMap.MercartorSphere = MercartorSphere;
        }

        private getBingMapCanvas(resolution): JQuery {
            let tileSize: number = 256;
            let numSegments: number = Math.pow(2, resolution);
            let numTiles: number = numSegments * numSegments;
            let tilesLoaded: number = 0;
            let canvasSize: number = tileSize * numSegments;
            let canvas: JQuery = $('<canvas/>').attr({ width: canvasSize, height: canvasSize });

            let canvasElem: HTMLCanvasElement = <any>canvas.get(0);
            let canvasContext: CanvasRenderingContext2D = canvasElem.getContext("2d");

            function generateQuads(res, quad) {
                if (res <= resolution) {
                    if (res === resolution) {
                        loadTile(quad);
                    }

                    generateQuads(res + 1, quad + "0");
                    generateQuads(res + 1, quad + "1");
                    generateQuads(res + 1, quad + "2");
                    generateQuads(res + 1, quad + "3");
                }
            }

            function loadTile(quad) {
                let template: any = "https://t{server}.tiles.virtualearth.net/tiles/r{quad}.jpeg?g=0&mkt={language}";
                let numServers: number = 7;
                let server: number = Math.round(Math.random() * numServers);
                let language: string = (navigator["languages"] && navigator["languages"].length) ? navigator["languages"][0] : navigator.language;
                let url: any = template.replace("{server}", server)
                    .replace("{quad}", quad)
                    .replace("{language}", language);
                let coords: any = getCoords(quad);
                let tile: HTMLImageElement = new Image();
                tile.onload = function () {
                    tilesLoaded++;
                    canvasContext.drawImage(tile, coords.x * tileSize, coords.y * tileSize, tileSize, tileSize);
                    if (tilesLoaded === numTiles) {
                        canvas.trigger("ready", resolution);
                    }
                };

                // So the canvas doesn't get tainted
                tile.crossOrigin = '';
                tile.src = url;
            }

            function getCoords(quad) {
                let x: number = 0;
                let y: number = 0;
                let last: number = quad.length - 1;

                for (let i: number = last; i >= 0; i--) {
                    let chr: any = quad.charAt(i);
                    let pow: number = Math.pow(2, last - i);

                    if (chr === "1") {
                        x += pow;
                    } else if (chr === "2") {
                        y += pow;
                    } else if (chr === "3") {
                        x += pow;
                        y += pow;
                    }
                }

                return { x: x, y: y };
            }

            generateQuads(0, "");
            return canvas;
        }
    }
}
