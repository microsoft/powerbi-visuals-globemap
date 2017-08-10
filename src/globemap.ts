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

let WebGLHeatmap: any = window["createWebGLHeatmap"];

module powerbi.extensibility.visual {
    // powerbi.extensibility.geocoder
    import IGeocoder = powerbi.extensibility.geocoder.IGeocoder;
    import IGeocodeCoordinate = powerbi.extensibility.geocoder.IGeocodeCoordinate;
    import ILocation = powerbi.extensibility.geocoder.ILocation;

    // powerbi.extensibility.utils.dataview
    import converterHelper = powerbi.extensibility.utils.dataview.converterHelper;

    // powerbi.extensibility.utils.color
    import ColorHelper = powerbi.extensibility.utils.color.ColorHelper;

    // powerbi.visuals
    import ISelectionId = powerbi.visuals.ISelectionId;

    // powerbi.extensibility.utils.formatting
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import LocalStorageService = powerbi.extensibility.utils.formatting.LocalStorageService;
    import IStorageService = powerbi.extensibility.utils.formatting.IStorageService;

    // powerbi.extensibility.utils.type
    import ValueType = powerbi.extensibility.utils.type.ValueType;

    interface ExtendedPromise<T> extends IPromise<T> {
        always(value: any): void;
    }
    export class GlobeMap implements IVisual {
        private localStorageService: IStorageService;
        public static MercartorSphere: any;
        private static GlobeSettings = {
            autoRotate: false,
            earthRadius: 30,
            cameraRadius: 100,
            earthSegments: 100,
            heatmapSize: 1024,
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
        private static ChangeDataType: number = 2;
        private static ChangeAllType: number = 62;
        private static DataPointFillProperty: DataViewObjectPropertyIdentifier = {
            objectName: "dataPoint",
            propertyName: "fill"
        };
        private static CountTilesPerSegment: number = 4;
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
        public barsGroup: THREE.Object3D;
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
        public colors: IColorPalette;
        private animationFrameId: number;
        private cameraAnimationFrameId: number;
        public visualHost: IVisualHost;

        private tooltipService: ITooltipService;
        private static datapointShiftPoint: number = 0.01;
        public static converter(dataView: DataView, colors: IColorPalette, visualHost: IVisualHost): GlobeMapData {

            const categorical: GlobeMapColumns<DataViewCategoryColumn & DataViewValueColumn[] & DataViewValueColumns> = GlobeMapColumns.getCategoricalColumns(dataView);
            if (!categorical || !categorical.Category || _.isEmpty(categorical.Category.values)
                || (_.isEmpty(categorical.Height) && _.isEmpty(categorical.Heat))) {
                return null;
            }
            const properties: GlobeMapSettings = GlobeMapSettings.getDefault() as GlobeMapSettings;
            const settings: GlobeMapSettings = GlobeMap.parseSettings(dataView);
            const groupedColumns: GlobeMapColumns<DataViewValueColumn>[] | any = GlobeMapColumns.getGroupedValueColumns(dataView);
            const dataPoints: any = [];
            let seriesDataPoints: any = [];
            let locations: any = [];
            const colorHelper: ColorHelper = new ColorHelper(colors, GlobeMap.DataPointFillProperty);
            let locationType: any;
            let heights: any;
            let heightsBySeries: any;
            let toolTipDataBySeries: any;
            let heats: any;

            if (categorical.Category && categorical.Category.values) {
                locations = categorical.Category.values;
                const sourceType: any = <any>categorical.Category.source.type;
                locationType = sourceType.category ? (<string>sourceType.category).toLowerCase() : "";
            } else {
                locations = [];
            }

            if (!_.isEmpty(categorical.Height)) {
                if (groupedColumns.length > 1) {
                    heights = [];
                    heightsBySeries = [];
                    toolTipDataBySeries = [];
                    seriesDataPoints = [];
                    // creating a matrix for drawing values by series later.
                    for (let i: number = 0; i < groupedColumns.length; i++) {
                        const values: any = groupedColumns[i].Height.values;

                        seriesDataPoints[i] = GlobeMap.createDataPointForEnumeration(
                            dataView, groupedColumns[i].Height.source, i, null, colorHelper, colors, visualHost);
                        for (let j: number = 0; j < values.length; j++) {
                            if (!heights[j]) {
                                heights[j] = 0;
                            }
                            heights[j] += values[j] ? values[j] : 0;
                            if (!heightsBySeries[j]) {
                                heightsBySeries[j] = [];
                            }
                            heightsBySeries[j][i] = values[j];
                            if (!toolTipDataBySeries[j]) {
                                toolTipDataBySeries[j] = [];
                            }
                            toolTipDataBySeries[j][i] = {
                                displayName: categorical.Series && categorical.Series.source.displayName,
                                value: dataView.categorical.values.grouped()[i].name,
                                dataPointValue: values[j]
                            };
                        }
                    }
                    for (let i: number = 0; i < groupedColumns.length; i++) {
                        const values: any = groupedColumns[i].Height.values;
                        for (let j: number = 0; j < values.length; j++) {
                            // calculating relative size of series
                            heightsBySeries[j][i] = <number>values[j] / heights[j];
                        }
                    }
                } else {
                    heights = categorical.Height[0].values;
                    heightsBySeries = [];
                    seriesDataPoints[0] = GlobeMap.createDataPointForEnumeration(
                        dataView, groupedColumns[0].Height.source, 0, dataView.metadata, colorHelper, colors, visualHost);
                }
            } else {
                heightsBySeries = [];
                heights = [];
            }
            if (!_.isEmpty(categorical.Heat)) {
                if (groupedColumns.length > 1) {
                    heats = [];
                    for (let i: number = 0; i < groupedColumns.length; i++) {
                        const values: any = groupedColumns[i].Heat.values;
                        for (let j = 0; j < values.length; j++) {
                            if (!heats[j]) {
                                heats[j] = 0;
                            }
                            heats[j] += values[j] ? values[j] : 0;
                        }
                    }
                } else {
                    heats = categorical.Heat[0].values;
                }

            } else {
                heats = [];
            }

            const maxHeight: any = Math.max.apply(null, heights) || 1;
            const maxHeat: any = Math.max.apply(null, heats) || 1;
            const heatFormatter: IValueFormatter = valueFormatter.create({
                format: !_.isEmpty(categorical.Heat) && categorical.Heat[0].source.format,
                value: heats[0],
                value2: heats[1]
            });
            const heightFormatter = valueFormatter.create({
                format: !_.isEmpty(categorical.Height) && categorical.Height[0].source.format,
                value: heights[0],
                value2: heights[1]
            });
            const len: number = locations.length;
            for (let i: number = 0; i < len; ++i) {
                if (typeof (locations[i]) === "string") {
                    const place: any = locations[i].toLowerCase();
                    const placeKey: string = place + "/" + locationType;
                    const location: ILocation = (!_.isEmpty(categorical.X) && !_.isEmpty(categorical.Y))
                        ? { longitude: <number>categorical.X[0].values[i] || 0, latitude: <number>categorical.Y[0].values[i] || 0 }
                        : undefined;

                    const height: number = heights[i] / maxHeight;
                    const heat: number = heats[i] / maxHeat;

                    const renderDatum: GlobeMapDataPoint = {
                        location: location,
                        placeKey: placeKey,
                        place: place,
                        locationType: locationType,
                        height: height ? height || GlobeMap.datapointShiftPoint : undefined,
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
            return GlobeMapSettings.parse(dataView) as GlobeMapSettings;
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

            const columns: DataViewValueColumnGroup = dataView.categorical.values.grouped()[seriesIndex];
            const values: DataViewValueColumns = <DataViewValueColumns>columns.values;
            let sourceForFormat: DataViewMetadataColumn = source;
            let nameForFormat: PrimitiveValue = source.displayName;
            if (source.groupName !== undefined) {
                sourceForFormat = values.source;
                nameForFormat = source.groupName;
            }

            const label: string = valueFormatter.format(nameForFormat, valueFormatter.getFormatString(sourceForFormat, null));

            let measureValues = values[0];
            const categoryColumn: DataViewCategoryColumn = {
                source: measureValues.source,
                values: null,
                identity: [measureValues.identity]
            };

            const identity: ISelectionId = visualHost.createSelectionIdBuilder()
                .withCategory(categoryColumn, 0)
                .withMeasure(measureValues.source.queryName)
                .createSelectionId();

            const category: any = <string>converterHelper.getSeriesName(source);
            const objects: any = <any>columns.objects || <any>source.objects;
            const color: string = objects && objects.dataPoint ? objects.dataPoint.fill.solid.color : metaData && metaData.objects
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

        private addAnInstanceToEnumeration(
            instanceEnumeration: VisualObjectInstanceEnumeration,
            instance: VisualObjectInstance): void {

            if ((instanceEnumeration as VisualObjectInstanceEnumerationObject).instances) {
                (instanceEnumeration as VisualObjectInstanceEnumerationObject)
                    .instances
                    .push(instance);
            } else {
                (instanceEnumeration as VisualObjectInstance[]).push(instance);
            }
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            let instances: VisualObjectInstanceEnumeration = GlobeMapSettings.enumerateObjectInstances(this.settings || GlobeMapSettings.getDefault(), options);
            switch (options.objectName) {
                case "dataPoint": if (this.data && this.data.seriesDataPoints) {
                    for (let i: number = 0; i < this.data.seriesDataPoints.length; i++) {
                        let dataPoint: GlobeMapSeriesDataPoint = this.data.seriesDataPoints[i];
                        this.addAnInstanceToEnumeration(instances, {
                            objectName: "dataPoint",
                            displayName: dataPoint.label,
                            selector: ColorHelper.normalizeSelector((dataPoint.identity as ISelectionId).getSelector()),
                            properties: {
                                fill: { solid: { color: dataPoint.color } }
                            }
                        });
                    }
                }
                    break;
            }
            return instances;
        }

        constructor(options: VisualConstructorOptions) {
            this.currentLanguage = options.host.locale;
            this.localStorageService = new LocalStorageService();
            this.root = $("<div>").appendTo(options.element)
                .attr("drag-resize-disabled", "true")
                .css({
                    "position": "absolute"
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
            this.initScene();
            this.initMercartorSphere();
            this.initTextures().then(
                () => {
                    this.earth = this.createEarth();
                    this.scene.add(this.earth);
                    this.readyToRender = true;
                });
            this.initZoomControl();
            this.initHeatmap();
            this.initRayCaster();
        }
        private static cameraFov: number = 35;
        private static cameraNear: number = 0.1;
        private static cameraFar: number = 10000;
        private static clearColor: number = 0xbac4d2;
        private static ambientLight: number = 0x000000;
        private static directionalLight: number = 0xffffff;
        private static directionalLightIntensity: number = 0.4;
        private static tileSize: number = 256;
        private static initialResolutionLevel: number = 2;
        private static maxResolutionLevel: number = 5;
        private static metadataUrl: string = `https://dev.virtualearth.net/REST/V1/Imagery/Metadata/Road?output=json&uriScheme=https&key=${powerbi.extensibility.geocoder.Settings.BingKey}`;
        private static reserveBindMapsMetadata: BingResourceMetadata = {
            imageUrl: "https://{subdomain}.tiles.virtualearth.net/tiles/r{quadkey}.jpeg?g=0&mkt={culture}",
            imageUrlSubdomains: [
                "t1",
                "t2",
                "t3",
                "t4",
                "t5",
                "t6",
                "t7"
            ],
            imageHeight: 256,
            imageWidth: 256
        };
        private currentLanguage: string = "en-GB";
        private static TILE_STORAGE_KEY = "GLOBEMAP_TILES_STORAGE";
        private static TILE_LANGUAGE_CULTURE = "GLOBEMAP_TILE_LANGUAGE_CULTURE";
        private initScene(): void {
            this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
            this.rendererContainer = $("<div>").appendTo(this.root).addClass("globeMapView");

            this.rendererContainer.append(this.renderer.domElement);
            this.rendererCanvas = this.renderer.domElement;
            this.camera = new THREE.PerspectiveCamera(GlobeMap.cameraFov, this.layout.viewportIn.width / this.layout.viewportIn.height, GlobeMap.cameraNear, GlobeMap.cameraFar);
            this.orbitControls = new THREE.OrbitControls(this.camera, this.rendererCanvas);
            this.orbitControls.enablePan = false;
            this.scene = new THREE.Scene();

            this.renderer.setSize(this.layout.viewportIn.width, this.layout.viewportIn.height);
            this.renderer.setClearColor(GlobeMap.clearColor, 1);
            this.camera.position.z = GlobeMap.GlobeSettings.cameraRadius;

            this.orbitControls.maxDistance = GlobeMap.GlobeSettings.cameraRadius;
            this.orbitControls.minDistance = GlobeMap.GlobeSettings.earthRadius + 1;
            this.orbitControls.rotateSpeed = GlobeMap.GlobeSettings.rotateSpeed;
            this.orbitControls.zoomSpeed = GlobeMap.GlobeSettings.zoomSpeed;
            this.orbitControls.autoRotate = GlobeMap.GlobeSettings.autoRotate;

            const ambientLight: THREE.AmbientLight = new THREE.AmbientLight(GlobeMap.ambientLight);
            const light1: THREE.DirectionalLight = new THREE.DirectionalLight(GlobeMap.directionalLight, GlobeMap.directionalLightIntensity);
            const light2: THREE.DirectionalLight = new THREE.DirectionalLight(GlobeMap.directionalLight, GlobeMap.directionalLightIntensity);

            this.scene.add(ambientLight);
            this.scene.add(light1);
            this.scene.add(light2);

            light1.position.set(20, 20, 20);
            light2.position.set(0, 0, -20);

            const render: any = () => {
                try {
                    if (this.renderLoopEnabled) {
                        this.animationFrameId = requestAnimationFrame(render);
                    }
                    if (!this.shouldRender()) {
                        return;
                    }
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
            const geometry: any = new GlobeMap.MercartorSphere(
                GlobeMap.GlobeSettings.earthRadius,
                GlobeMap.GlobeSettings.earthSegments,
                GlobeMap.GlobeSettings.earthSegments);
            const material: THREE.MeshPhongMaterial = new THREE.MeshPhongMaterial({
                map: this.mapTextures[0],
                side: THREE.DoubleSide,
                shading: THREE.SmoothShading,
                shininess: 1
            });

            const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
            mesh.add(new THREE.AmbientLight(0xaaaaaa, 1));

            return mesh;
        }

        private static dollyX: number = 0.95;
        public zoomClicked(zoomDirection: number): void {
            if (this.orbitControls.enabled === false) {
                return;
            }

            if (zoomDirection === -1) {
                this.orbitControls.dollyOut(Math.pow(GlobeMap.dollyX, GlobeMap.GlobeSettings.zoomSpeed));
            } else if (zoomDirection === 1) {
                this.orbitControls.dollyIn(Math.pow(GlobeMap.dollyX, GlobeMap.GlobeSettings.zoomSpeed));
            }

            this.orbitControls.update();
            this.animateCamera(this.camera.position);
        }

        public rotateCam(deltaX: number, deltaY: number): void {
            if (!this.orbitControls.enabled) {
                return;
            }
            this.orbitControls.rotateLeft(2 * Math.PI * deltaX / this.rendererCanvas.offsetHeight * GlobeMap.GlobeSettings.rotateSpeed);
            this.orbitControls.rotateUp(2 * Math.PI * deltaY / this.rendererCanvas.offsetHeight * GlobeMap.GlobeSettings.rotateSpeed);
            this.orbitControls.update();
            this.animateCamera(this.camera.position);
        }

        private initTextures(): JQueryPromise<{}> {
            this.mapTextures = [];
            const tileCulture: string = this.localStorageService.getData(GlobeMap.TILE_LANGUAGE_CULTURE);
            let tileCache: TileMap[] = this.localStorageService.getData(GlobeMap.TILE_STORAGE_KEY);
            if (!tileCache || tileCulture !== this.currentLanguage) {
                // Initialize once, since this is a CPU + Network heavy operation.
                return this.getBingMapsServerMetadata()
                    .then((metadata: BingResourceMetadata) => {
                        tileCache = [];
                        let urlTemplate = metadata.imageUrl.replace("{culture}", this.currentLanguage);
                        for (let level: number = GlobeMap.initialResolutionLevel; level <= GlobeMap.maxResolutionLevel; ++level) {
                            let levelTiles = this.generateQuadsByLevel(level, urlTemplate, metadata.imageUrlSubdomains);
                            this.mapTextures.push(this.createTexture(level, levelTiles));
                            tileCache.push(levelTiles);
                        }
                        this.localStorageService.setData(GlobeMap.TILE_STORAGE_KEY, tileCache);
                        this.localStorageService.setData(GlobeMap.TILE_LANGUAGE_CULTURE, this.currentLanguage);
                        return tileCache;
                    });
            } else {
                for (let level: number = GlobeMap.initialResolutionLevel; level <= GlobeMap.maxResolutionLevel; ++level) {
                    this.mapTextures.push(this.createTexture(level, tileCache[level - GlobeMap.initialResolutionLevel]));
                }
                return jQuery.when(tileCache);
            }
        }

        private getBingMapsServerMetadata(): JQueryPromise<BingResourceMetadata> {
            return $.ajax(GlobeMap.metadataUrl)
                .then((data: BingMetadata) => {
                    if (data.resourceSets.length) {
                        let resourceSet = data.resourceSets[0];
                        if (resourceSet && resourceSet.resources.length) {
                            return resourceSet.resources[0];
                        }
                    }
                    throw "Bing Maps API response was changed. Please update code for new version";
                })
                .fail((error: any) => {
                    console.error(JSON.stringify(error));
                    return GlobeMap.reserveBindMapsMetadata;
                });
        }

        /**
         * Generate Bing tile object by map level
         * @see https://msdn.microsoft.com/en-us/library/bb259689.aspx
         * @private
         * @param {number} level map lavel
         * @param {string} urlTemplate url template
         * @example https://ecn.{subdomain}.tiles.virtualearth.net/tiles/r{quadkey}.jpeg?g=5691&mkt={culture}&shading=hill
         * @param {string[]} subdomains list of subdomauns
         * @returns {{ [quadKey: string]: string }} Object <quadKey> : <image url>
         * @memberOf GlobeMap
         */
        private generateQuadsByLevel(level: number, urlTemplate: string, subdomains: string[]): TileMap {
            const result: TileMap = {};
            let currentSubDomainNumber: number = 0;
            const generateQuard = (currentLevel: number = 0, quadKey: string = ""): void => {
                if (currentLevel < level) {
                    for (let i = 0; i < GlobeMap.CountTilesPerSegment; i++) {
                        generateQuard(currentLevel + 1, `${quadKey}${i}`);
                    }
                } else if (currentLevel === level) {
                    result[quadKey] = urlTemplate.replace("{subdomain}", subdomains[currentSubDomainNumber]).replace("{quadkey}", quadKey);
                    currentSubDomainNumber++;
                    currentSubDomainNumber = currentSubDomainNumber < subdomains.length ? currentSubDomainNumber : 0;
                }
            };
            generateQuard();
            return result;
        }

        private createTexture(level: number, tiles: TileMap): THREE.Texture {
            const numSegments: number = Math.pow(2, level);
            const canvasSize: number = GlobeMap.tileSize * numSegments;
            const canvas: HTMLCanvasElement = document.createElement("canvas");
            canvas.width = canvasSize;
            canvas.height = canvasSize;
            const texture: THREE.Texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            this.loadTiles(canvas, tiles, () => {
                texture.needsUpdate = true;
                this.needsRender = true;
            });
            return texture;
        }

        /**
         * Load tiles of Bing Maps
         * @param jCanvas jQuery convas object
         * @param tiles map of tiles
         * @param successCallback call this function when all tiles of the map are successfully loaded
         */
        private loadTiles(canvasEl: HTMLCanvasElement, tiles: TileMap, successCallback: Function): void {
            let tilesLoaded: number = 0;
            const countTiles: number = Object.keys(tiles).length;
            const canvasContext: CanvasRenderingContext2D = canvasEl.getContext("2d");
            for (let quadKey in tiles) {
                if (tiles.hasOwnProperty(quadKey)) {
                    const coords: any = this.getCoordByQuadKey(quadKey);
                    const tile: HTMLImageElement = new Image();
                    tile.onload = (event: Event) => {
                        tilesLoaded++;
                        canvasContext.drawImage(tile, coords.x * GlobeMap.tileSize, coords.y * GlobeMap.tileSize, GlobeMap.tileSize, GlobeMap.tileSize);
                        if (tilesLoaded === countTiles) {
                            successCallback();
                        }
                    };
                    // So the canvas doesn't get tainted
                    tile.crossOrigin = "";
                    tile.src = tiles[quadKey];
                }
            }
        }

        /**
         * Get coordinates by Bing Maps quard name
         * @private
         * @param {string} quard Bing Maps quard name
         * @returns {CanvasCoordinate} image coordinate
         * @memberOf GlobeMap
         */
        private getCoordByQuadKey(quard: string): CanvasCoordinate {
            const last: number = quard.length - 1;
            let x: number = 0;
            let y: number = 0;

            for (let i: number = last; i >= 0; i--) {
                const chr: string = quard.charAt(i);
                const pow: number = Math.pow(2, last - i);
                switch (chr) {
                    case "1": x += pow; break;
                    case "2": y += pow; break;
                    case "3": x += pow; y += pow; break;
                }
            }

            return { x: x, y: y };
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
            const texture: THREE.Texture = this.heatTexture = new THREE.Texture(heatmap.canvas);
            texture.needsUpdate = true;

            const material: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
            const geometry: THREE.SphereGeometry = new THREE.SphereGeometry(GlobeMap.GlobeSettings.earthRadius + 0.01, GlobeMap.GlobeSettings.earthSegments, GlobeMap.GlobeSettings.earthSegments);
            const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);

            window["heatmap"] = heatmap;
            window["heatmapTexture"] = texture;

            this.scene.add(mesh);
        }

        private setEarthTexture(): void {
            // get distance as arbitrary value from 0-1
            if (!this.camera) {
                return;
            }
            const maxDistance: number = GlobeMap.GlobeSettings.cameraRadius - GlobeMap.GlobeSettings.earthRadius;
            const distance: number = (this.camera.position.length() - GlobeMap.GlobeSettings.earthRadius) / maxDistance;
            let texture: THREE.Texture = this.mapTextures[0];
            for (let divider: number = GlobeMap.initialResolutionLevel; divider <= GlobeMap.maxResolutionLevel; divider++) {
                if (distance <= divider / GlobeMap.maxResolutionLevel) {
                    texture = this.mapTextures[GlobeMap.maxResolutionLevel - divider];
                    break;
                }
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
            if (options.dataViews === undefined || options.dataViews === null) {
                return;
            }
            this.layout.viewport = options.viewport;
            this.root.css(this.layout.viewportIn);
            this.zoomContainer.style({
                "display": this.layout.viewportIn.height > GlobeMap.ZoomControlSettings.height
                    && this.layout.viewportIn.width > GlobeMap.ZoomControlSettings.width
                    ? null : "none"
            });

            if (this.layout.viewportChanged) {
                if (this.camera && this.renderer) {
                    this.camera.aspect = this.layout.viewportIn.width / this.layout.viewportIn.height;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(this.layout.viewportIn.width, this.layout.viewportIn.height);
                    this.renderer.render(this.scene, this.camera);
                }
            }

            if (options.type === GlobeMap.ChangeDataType || options.type === GlobeMap.ChangeAllType) {
                this.cleanHeatAndBar();
                const data: GlobeMapData = GlobeMap.converter(options.dataViews[0], this.colors, this.visualHost);
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
            this.data.dataPoints.forEach(d => this.geocodeRenderDatum(d)); // all coordinates (latitude/longitude) will be gained here
            this.data.dataPoints.forEach((d) => {
                return d.location = this.globeMapLocationCache[d.placeKey] || d.location;
            });

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
            const len: number = this.data.dataPoints.length;
            for (let i: number = 0; i < len; ++i) {
                const renderDatum: GlobeMapDataPoint = this.data.dataPoints[i];

                if (!renderDatum.location || renderDatum.location.longitude === undefined || renderDatum.location.latitude === undefined
                    || (renderDatum.location.longitude === 0 && renderDatum.location.latitude === 0)
                ) {
                    continue;
                }

                if (renderDatum.heat > 0.001) {
                    if (renderDatum.heat < 0.1) renderDatum.heat = 0.1;
                    const x: number = (180 + renderDatum.location.longitude) / 360 * GlobeMap.GlobeSettings.heatmapSize;
                    const y: number = (1 - ((90 + renderDatum.location.latitude) / 180)) * GlobeMap.GlobeSettings.heatmapSize;
                    this.heatmap.addPoint(x, y, GlobeMap.GlobeSettings.heatPointSize, renderDatum.heat * GlobeMap.GlobeSettings.heatIntensity);
                }

                if (renderDatum.height >= 0) {
                    if (renderDatum.height < 0.01) renderDatum.height = 0.01;
                    const latRadians: number = renderDatum.location.latitude / 180 * Math.PI; // radians
                    const lngRadians: number = renderDatum.location.longitude / 180 * Math.PI;

                    const x: number = Math.cos(lngRadians) * Math.cos(latRadians);
                    const z: number = -Math.sin(lngRadians) * Math.cos(latRadians);
                    const y: number = Math.sin(latRadians);
                    const vector: THREE.Vector3 = new THREE.Vector3(x, y, z);

                    this.averageBarVector.add(vector);

                    const barHeight: number = GlobeMap.GlobeSettings.barHeight * renderDatum.height;
                    // this array holds the relative series values to the actual measure for example [0.2,0.3,0.5]
                    // this is how we draw the vectors relativly to the complete value one on top of another.
                    const measuresBySeries: any = [];
                    // this array holds the original values of the series for the tool tips
                    const dataPointToolTip: any = [];
                    if (renderDatum.heightBySeries) {
                        for (let c: number = 0; c < renderDatum.heightBySeries.length; c++) {
                            if (renderDatum.heightBySeries[c] || renderDatum.heightBySeries[c] === 0) {
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
                        const geometry: THREE.BoxGeometry = new THREE.BoxGeometry(GlobeMap.GlobeSettings.barWidth, GlobeMap.GlobeSettings.barWidth, barHeight * measuresBySeries[j]);
                        const bar: THREE.Mesh = new THREE.Mesh(geometry, this.getBarMaterialByIndex(j));
                        const position: THREE.Vector3 = vector.clone().multiplyScalar(GlobeMap.GlobeSettings.earthRadius + ((barHeight / 2) * previousMeasureValue));
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

        private getBarMaterialByIndex(index: number): THREE.MeshPhongMaterial {
            return new THREE.MeshPhongMaterial({ color: this.data.seriesDataPoints[index].color });
        }

        private getToolTipDataForSeries(toolTipData, dataPointToolTip): any {
            const result: any = jQuery.extend(true, {
                series: { displayName: dataPointToolTip.displayName, value: dataPointToolTip.value }
            }, toolTipData);
            result.height.value = dataPointToolTip.dataPointValue;
            return result;
        }

        private geocodeRenderDatum(renderDatum: GlobeMapDataPoint) {
            // zero valued locations should be updated
            if ((renderDatum.location && renderDatum.location.longitude !== 0 && renderDatum.location.latitude !== 0) || this.globeMapLocationCache[renderDatum.placeKey]) {
                return;
            }

            const location: ILocation = <any>{};
            let geocoder: IGeocoder;
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

            const element: HTMLElement = this.root.get(0);
            let mouseDownTime: number;
            const elementStyle: CSSStyleDeclaration = window.getComputedStyle(element);

            $(this.rendererCanvas).on("mousemove", (event: JQueryEventObject) => {
                const elementViewHeight: number = element.offsetHeight - element.offsetTop
                    - parseFloat(elementStyle.paddingTop)
                    - parseFloat(elementStyle.paddingBottom);

                const elementViewWidth: number = element.offsetWidth - element.offsetLeft
                    - parseFloat(elementStyle.paddingLeft)
                    - parseFloat(elementStyle.paddingRight);

                const fractionalPositionX: number = event.offsetX / elementViewWidth;
                const fractionalPositionY: number = event.offsetY / elementViewHeight;

                this.mousePos = new THREE.Vector2(event.clientX, event.clientY);

                // get coordinates in -1 to +1 space
                this.mousePosNormalized = new THREE.Vector2(fractionalPositionX * 2 - 1, -fractionalPositionY * 2 + 1);

                this.needsRender = true;
            }).on("mousedown", (event: JQueryEventObject) => {
                cancelAnimationFrame(this.cameraAnimationFrameId);
                mouseDownTime = Date.now();
            }).on("mouseup", (event: JQueryEventObject) => {

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
                    const delta: number = e.wheelDelta > 0 || e.detail < 0 ? 1 : -1;
                    const scale: number = delta > 0 ? GlobeMap.GlobeSettings.heatmapScaleOnZoom : (1 / GlobeMap.GlobeSettings.heatmapScaleOnZoom);
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

            const rayCaster: THREE.Raycaster = this.rayCaster;

            rayCaster.setFromCamera(this.mousePosNormalized, this.camera);
            const intersects: THREE.Intersection[] = rayCaster.intersectObjects(this.barsGroup.children);

            if (intersects && intersects.length > 0) {
                const object: THREE.Object3D = intersects[0].object;

                if (!object || !(<any>object).toolTipData) {
                    return;
                }

                const toolTipData: any = (<any>object).toolTipData;
                const toolTipItems: VisualTooltipDataItem[] = [];

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

            if (!this.camera) {
                return;
            }
            cancelAnimationFrame(this.cameraAnimationFrameId);
            const startTime: number = Date.now();
            const duration: number = GlobeMap.GlobeSettings.cameraAnimDuration;
            const endTime: number = startTime + duration;
            const startPos: THREE.Vector3 = this.camera.position.clone().normalize();
            const endPos: THREE.Vector3 = to.clone().normalize();
            const length: number = this.camera.position.length();
            const two: number = 2;
            const one: number = 2;
            const easeInOut = (t) => {
                t *= two;
                if (t < one) {
                    return (t * t * t) / two;
                }
                t -= two;
                return (t * t * t + two) / two;
            };

            const onUpdate: any = () => {
                const now: number = Date.now();
                let t: number = (now - startTime) / duration;
                if (t > one) {
                    t = one;
                }
                t = easeInOut(t);

                const pos: THREE.Vector3 = new THREE.Vector3()
                    .add(startPos.clone().multiplyScalar(one - t))
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
                    const extension: any = this.renderer.context.getExtension("WEBGL_lose_context");
                    if (extension) {
                        extension.loseContext();
                    }
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
        private static ZoomControlSettings = {
            height: 145,
            width: 145,
            markup: `
            <svg width="145" height="145" class="controls">
                <g class="control js-control--move-up">
                    <circle cx="85" cy="20" r="17" />
                    <path d="M85 8 l12 20 a40,70 0 0,0 -24,0z" />
                </g>
                <g class="control js-control--move-right">
                    <circle cx="119" cy="54" r="17" class="zoomControlCircle" />
                    <path d="M130.9 54 l-20 -12 a70,40 0 0,1 0,24z" class="zoomControlPath" />
                </g>
                <g class="control js-control--move-down">
                    <circle cx="85" cy="88" r="17" />
                    <path d="M 85 100 l12 -20 a40,70 0 0,1 -24,0z" />
                </g>
                <g class="control js-control--move-left">
                    <circle cx="51" cy="54" r="17" />
                    <path d="M39 54 l20 -12 a70,40 0 0,0 0,24z" />
                </g>
                <g class="control js-control--zoom-down">
                    <circle cx="51" cy="122" r="17" />
                    <rect x="42" y="120" width="17" height="6" class="zoomControlPath" />
                </g>
                <g class="control js-control--zoom-up">
                    <circle cx="119" cy="122" r="17" />
                    <rect x="110.5" y="120" width="17" height="6" />
                    <rect x="116" y="114" width="6" height="17" />
                </g>
            </svg>
            `,
            zoomStep: 1,
            angleOfRotation: 5

        };
        private initZoomControl() {
            const controlContainer: HTMLElement = document.createElement("div");
            controlContainer.classList.add("controls-container");
            controlContainer.innerHTML = GlobeMap.ZoomControlSettings.markup;
            this.root.append(controlContainer);
            function onMouseDown(callback: (element: SVGElement) => void) {
                (d3.event as MouseEvent).stopPropagation();
                if ((<any>d3.event).button === 0) {
                    callback((<any>d3.event).currentTarget);
                }
            }
            this.zoomContainer = d3.select(controlContainer);
            this.zoomContainer
                .selectAll("g")
                .on("mousedown", () => onMouseDown(
                    (element: SVGElement) => {
                        const controlType = element.classList.toString().split(" ").filter(className => className.search("js-") !== -1)[0];
                        switch (controlType) {
                            case "js-control--move-up": this.rotateCam(0, GlobeMap.ZoomControlSettings.angleOfRotation); break;
                            case "js-control--move-down": this.rotateCam(0, -GlobeMap.ZoomControlSettings.angleOfRotation); break;
                            case "js-control--move-left": this.rotateCam(GlobeMap.ZoomControlSettings.angleOfRotation, 0); break;
                            case "js-control--move-right": this.rotateCam(-GlobeMap.ZoomControlSettings.angleOfRotation, 0); break;
                            case "js-control--zoom-up": this.zoomClicked(-GlobeMap.ZoomControlSettings.zoomStep); break;
                            case "js-control--zoom-down": this.zoomClicked(GlobeMap.ZoomControlSettings.zoomStep); break;
                        }
                    }));
        }
        private initMercartorSphere() {
            if (GlobeMap.MercartorSphere) return;

            const MercartorSphere: any = function (radius: number, widthSegments: number, heightSegments: number): void {
                THREE.Geometry.call(this);

                this.radius = radius;
                this.widthSegments = widthSegments;
                this.heightSegments = heightSegments;

                this.t = 0;

                let x: number;
                let y: number;
                const vertices = [];
                const uvs = [];

                function interplolate(a, b, t) {
                    return (1 - t) * a + t * b;
                }

                // interpolates between sphere and plane
                function interpolateVertex(u: number, v: number, t: number) {
                    const maxLng: number = Math.PI * 2;
                    const maxLat: number = Math.PI;

                    const sphereX: number = - this.radius * Math.cos(u * maxLng) * Math.sin(v * maxLat);
                    const sphereY: number = - this.radius * Math.cos(v * maxLat);
                    const sphereZ: number = this.radius * Math.sin(u * maxLng) * Math.sin(v * maxLat);

                    const planeX: number = u * this.radius * 2 - this.radius;
                    const planeY: number = v * this.radius * 2 - this.radius;
                    const planeZ: number = 0;

                    const x1: number = interplolate(sphereX, planeX, t);
                    const y1: number = interplolate(sphereY, planeY, t);
                    const z: number = interplolate(sphereZ, planeZ, t);

                    return new THREE.Vector3(x1, y1, z);
                }

                // http://mathworld.wolfram.com/MercatorProjection.html
                // Mercator projection goes form +85.05 to -85.05 degrees
                function interpolateUV(u, v, t) {
                    const lat: number = (v - 0.5) * 89.99 * 2 / 180 * Math.PI; // turn from 0-1 into lat in radians
                    const sin: number = Math.sin(lat);
                    const normalizedV: number = 0.5 + 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;
                    return new THREE.Vector2(u, normalizedV); // interplolate(normalizedV1, v, t))
                }

                for (y = 0; y <= heightSegments; y++) {

                    const verticesRow: any = [];
                    const uvsRow: any = [];

                    for (x = 0; x <= widthSegments; x++) {

                        const u: number = x / widthSegments;
                        const v: number = y / heightSegments;

                        this.vertices.push(interpolateVertex.call(this, u, v, this.t));
                        uvsRow.push(interpolateUV.call(this, u, v, this.t));
                        verticesRow.push(this.vertices.length - 1);
                    }

                    vertices.push(verticesRow);
                    uvs.push(uvsRow);

                }

                for (y = 0; y < this.heightSegments; y++) {

                    for (x = 0; x < this.widthSegments; x++) {

                        const v1: any = vertices[y][x + 1];
                        const v2: any = vertices[y][x];
                        const v3: any = vertices[y + 1][x];
                        const v4: any = vertices[y + 1][x + 1];

                        const n1: any = this.vertices[v1].clone().normalize();
                        const n2: any = this.vertices[v2].clone().normalize();
                        const n3: any = this.vertices[v3].clone().normalize();
                        const n4: any = this.vertices[v4].clone().normalize();

                        const uv1: any = uvs[y][x + 1];
                        const uv2: any = uvs[y][x];
                        const uv3: any = uvs[y + 1][x];
                        const uv4: any = uvs[y + 1][x + 1];

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
    }
}