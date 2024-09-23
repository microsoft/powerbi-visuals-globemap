## 3.3.3.0
* Fixed deselection in Slicer wasn't apply to Globe map
* Update powerbi-visuals-api to 5.9.0
* Refactored cacheManager, LocalStorageCache, MemoryCache

## 3.3.2.0
* Fixed console error "undefined CustomVisualObjects"

## 3.3.1.0
* Fixed bug that occurs when resizing the visual
* Fixed console error in formatting mode

## 3.3.0.0
* Use new IVisualLocalStorageV2Service
* Update powerbi-visuals-api to 5.8.0
* Add onObject support

## 3.2.2.0
* Fix console error when using Heat without Height

## 3.2.1.0
* Updated all dependencies
* Changed max zoom level
* Changed scaling of heatmap and bars height and width
* Added sRGB color space for earth textures
* Changed conditions for dataview mapping

## 3.2.0
* Updated all dependencies
* Got rid of vulnerabilities
* Fixed issue with visual not displaying bars when only Latitide and Longitude buckets are selected

## 3.0.0
* Major refactoring
* Removed obsolete packages and APIs

## 2.5.2
* Webpack integration
* UPD: using StorageService for localStorage logic
* UPD: powerbi-visuals-tools 3.0.9 for StorageService usage
* UPD: powerbi-visuals-utils-testutils 2.1.6 for StorageService mocks usage
* Refactoring of coordinates loading: from memory, StorageService and Bing Geocode DataFlow API

## 2.5.1
* FIX: shifting for camera position was repaired

## 2.5.0
* UPD: using of easeInOutQuint algorithm to animate point selection
* UPD: animation is disabled for the initial load

## 2.4.2
* Fixes geocoding because it used to be broken since we converted Globe Map to API 1.12.0

## 2.4.1
* Location data field is no longer mandatory

## 2.4.0
* Added localization for all supported languages

## 2.3.4
* Bing key is hidden now

## 2.3.3
* Fixed breaking Bing key issue

## 2.3.2
* Fixed breaking issue in IE 11 

## 2.3.1
* Fix selection issue in Safari
* Add unit tests

## 2.3.0
* Remove d3 dependency
* Code refactoring

## 2.2.2
* Update tslint rules and code refactoring

## 2.2.1
* Focus on bar under cross selection

## 2.2.0
* Show data only by Location field
* Remove group bucket field
* Code refactoring

## 2.1.1
* Reduce min height of bars
* Increase speed of bars height resizing at zoom

## 2.1.0
* Bars and heats have dynamic size, depends on the zoom level
* Building coordinates only by longitude and latitude fields

## 2.0.1
* Increase the resolution level of map

## 2.0.0
* Performance improvement
* Update GUID of visual 

## 1.5.0
* Converts visual to the new Power BI Custom Visuals API (1.7.0)
* Includes l11n keys