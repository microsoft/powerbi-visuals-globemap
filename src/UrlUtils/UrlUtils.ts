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

namespace powerbi.extensibility.utils {
    import RegExpExtensions = powerbi.extensibility.utils.type.RegExpExtensions;
    export module Deprecated {
        export const escape: (s: string) => string = window['escape'];
        export const unescape: (s: string) => string = window['unescape'];
    }

    export interface TextMatch {
        start: number;
        end: number;
        text: string;
    }

    export module UrlUtils {
        const urlRegex = /http[s]?:\/\/(\S)+/gi;

        export function isValidUrl(value: string): boolean {
            if (_.isEmpty(value)) {
                return false;
            }

            let match: RegExpExecArray = RegExpExtensions.run(urlRegex, value);
            if (!!match && match.index === 0) {
                return true;
            }

            return false;
        }

        /* Tests whether a URL is valid.
         * @param url The url to be tested.
         * @returns Whether the provided url is valid.
         **/
        export function isValidImageUrl(url: string): boolean {
            // For now, passes for any valid Url
            return isValidUrl(url);
        }

        export function findAllValidUrls(text: string): TextMatch[] {
            if (_.isEmpty(text)) {
                return [];
            }

            // Find all urls in the text.
            // TODO: This could potentially be expensive, maybe include a cap here for text with many urls?
            let urlRanges: TextMatch[] = [];
            let matches: RegExpExecArray;
            let start: number = 0;
            while ((matches = RegExpExtensions.run(urlRegex, text, start)) !== null) {
                let url: any = matches[0];
                let end: number = matches.index + url.length;
                urlRanges.push({
                    start: matches.index,
                    end: end,
                    text: url,
                });
                start = end;
            }

            return urlRanges;
        }

        export function isDataUri(uri: string): boolean {
            return uri && uri.indexOf('data:') === 0;
        }

        export function getBase64ContentFromDataUri(uri: string): string {
            if (!isDataUri(uri)) {
                throw new Error("Expected data uri");
            }

            // Locate the base 64 content from the URL (e.g. "data:image/png;base64,xxxxx=")
            const base64Token = ";base64,";
            let indexBase64TokenStart: number = uri.indexOf(base64Token);
            if (indexBase64TokenStart < 0) {
                throw new Error("Expected base 64 content in data url");
            }

            let indexBase64Start: number = indexBase64TokenStart + base64Token.length;
            return uri.substr(indexBase64Start, uri.length - indexBase64Start);
        }

        /**
         * Create a base64 data URI for a string with a UTF-8 character encoding.
         * @param rawText {string} The text string to be encapsulated. It is the raw Javascript string
         */
        export function makeUTF8EncodedBase64DataUri(contentType: string, rawText: string): string {
            return "data:" + contentType + ";base64," + UrlUtils.utoa(rawText);
        }

        export function makeJsonDataUri(rawJson: string): string {
            return makeUTF8EncodedBase64DataUri("application/json", rawJson);
        }

        // btoa does not work for char codes > 0xff. for these we have to UTF-8 encode it
        // first. cleverly combining the deprecated functions unescape/escape with
        // encode/decodeURIComponent gets the browser to do all the work. in case
        // unescape/escape are not present, use slower Javascript implementations.
        // https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/btoa#Unicode_strings
        // http://ecmanaut.blogspot.com/2006/07/encoding-decoding-utf8-in-javascript.html
        // http://www.ecma-international.org/publications/files/ECMA-ST-ARCH/ECMA-262,%201st%20edition,%20June%201997.pdf#sec-15.1.2.4

        // exported for testing
        export function escapeSlow(s: string): string {
            if (!s) {
                return s;
            }

            return s.replace(/[^*+\-./0123456789@ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz]/g, unescaped => {
                let escaped: any = unescaped.charCodeAt(0).toString(16).toUpperCase();
                switch (escaped.length) {
                    case 1: return '%0' + escaped;
                    case 2: return '%' + escaped;
                    case 3: return '%u0' + escaped;
                    default: return '%u' + escaped;
                }
            });
        }

        // exported for testing
        export function unescapeSlow(s: string): string {
            if (!s) {
                return s;
            }

            return s.replace(/%([0-9a-fA-F]{2})|%u([0-9a-fA-F]{4})/g, (_, short, long) => {
                return String.fromCharCode(parseInt(short || long, 16));
            });
        }

        const unescape: (s: string) => string = Deprecated.unescape || unescapeSlow;
        const escape: (s: string) => string = Deprecated.escape || escapeSlow;

        export function encodeUTF8(s: string): string {
            return unescape(encodeURIComponent(s));
        }

        export function decodeUTF8(s: string): string {
            return decodeURIComponent(escape(s));
        }

        export function utoa(s: string): string {
            return btoa(encodeUTF8(s));
        }

        export function atou(s: string): string {
            return decodeUTF8(atob(s));
        }

        /** Returns the set of query parameters in a URL */
        export function getQueryParameters(url: string): _.Dictionary<string> {
            const query = getQueryString(url);

            if (!query) {
                return;
            }

            return parseQueryString(query);
        }

        /**
         * Given a URL, set the provided query string parameters
         * @param url The URL to modify
         * @param parameters The query parameters to set.
         * @param keepExisting if true, existing query parameters will be maintained, even if specified in the parameters argument. Else, all existing parameters are removed
         */
        export function setQueryParameters(url: string, parameters: _.Dictionary<string>, keepExisting = false): string {
            const splitUrl: any = splitUrlAndQuery(url);
            let result: string = splitUrl.baseUrl;

            if (keepExisting) {
                _.assign(parameters, splitUrl.queryParameters);
            }

            if (_.isEmpty(parameters)) {
                return result;
            }

            result += '?' + _.chain(parameters)
                .toPairs()
                .map(pair => pair.join('='))
                .value()
                .join('&');

            return result;
        }

        /** Given a URL, split it into the base URL (everything before the query string) and its collection of query string parameters */
        export function splitUrlAndQuery(url: string): { baseUrl: string, queryParameters: _.Dictionary<string> } {
            const queryString: string = getQueryString(url);
            const baseUrl: string = queryString ? url.slice(0, url.lastIndexOf(queryString)) : url;

            return {
                baseUrl: baseUrl,
                queryParameters: parseQueryString(queryString)
            };
        }

        export interface ParsedUrl {
            scheme: string;
            host: string;
            path: string;
            query: string;
            fragment: string;
        }

        export function parseUrl(url: string): ParsedUrl {
            // see http://www.ietf.org/rfc/rfc3986.txt, Appendix B (around page 50)
            // ^(?:([^:/?#]+):)?(?://([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?
            //     1                 2          3            4            5
            // http://www.ics.uci.edu/pub/ietf/uri/#Related
            // scheme   = $1 = http
            // host     = $2 = www.ics.uci.edu
            // path     = $3 = /pub/ietf/uri/
            // query    = $4 = <undefined>
            // fragment = $5 = Related
            let matches: RegExpMatchArray = url.match(/^(?:([^:\/?#]+):)?(?:\/\/([^\/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?/);
            if (matches) {
                return {
                    scheme: matches[1],
                    host: matches[2],
                    path: matches[3],
                    query: matches[4],
                    fragment: matches[5]
                };
            }
        }

        export function getHost(url: string): string {
            let parsed: ParsedUrl = parseUrl(url);
            return parsed && parsed.host;
        }

        const HostnameRegex: any = /https?:\/\/[^\/]+/i;

        /**
         * Returns everything in a URL after the hostname. Per RFC 3986, this is known as the absolute path reference.
         * @example for "https://foo.bar/hello/world", return "/hello/world".
         */
        export function getAbsolutePath(url: string): string {
            if (!url) {
                return url;
            }

            return url.replace(HostnameRegex, '');
        }

        function getQueryString(url: string): string {
            let elem: HTMLAnchorElement = document.createElement('a');
            elem.href = url;

            return elem.search;
        }

        /** Parses a query string of the form ?param1=value1&param2=value2 into its invidual parameters. The leading ? is not required */
        function parseQueryString(queryString: string): _.Dictionary<string> {
            if (!queryString) {
                return null;
            }

            if (_.startsWith(queryString, '?')) {
                queryString = queryString.substring(1);
            }

            let params: string[] = queryString.split("&");

            let result: _.Dictionary<string> = {};
            for (let keyEqualsValue of params) {
                let pair = keyEqualsValue.split("=");
                result[pair[0]] = decodeURIComponent(pair[1]);
            }

            return result;
        }
    }
}