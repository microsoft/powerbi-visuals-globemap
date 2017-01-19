
//module powerbi.extensibility.visual {
//    export interface IStorageService {
//        getData(key: string): any;
//        setData(key: string, data: any): void;
//    }

//    class LocalStorageService implements IStorageService {
//        public getData(key: string): any {
//            try {
//                if (localStorage) {
//                    let value = localStorage[key];
//                    if (value) {
//                        return JSON.parse(value);
//                    }
//                }
//            }
//            catch (exception) { }

//            return null;
//        }

//        public setData(key: string, data: any) {
//            try {
//                if (localStorage) {
//                    localStorage[key] = JSON.stringify(data);
//                }
//            }
//            catch (e) { }
//        }
//    }

//    export class EphemeralStorageService implements IStorageService {
//        private cache: { [key: string]: any } = {};
//        private clearCacheTimerId: number;
//        private clearCacheInterval: number;
//        public static defaultClearCacheInterval: number = (1000 * 60 * 60 * 24);  // 1 day

//        constructor(clearCacheInterval?: number) {
//            this.clearCacheInterval = (clearCacheInterval != null)
//                ? clearCacheInterval
//                : EphemeralStorageService.defaultClearCacheInterval;

//            this.clearCache();
//        }

//        public getData(key: string): any {
//            return this.cache[key];
//        }

//        public setData(key: string, data: any) {
//            this.cache[key] = data;

//            if (this.clearCacheTimerId == null) {
//                this.clearCacheTimerId = setTimeout(() => this.clearCache(), this.clearCacheInterval);
//            }
//        }

//        private clearCache(): void {
//            this.cache = {};
//            this.clearCacheTimerId = undefined;
//        }
//    }

//    export var localStorageService: IStorageService = new LocalStorageService();
//    export const ephemeralStorageService: IStorageService = new EphemeralStorageService();

//}