var libxmljs = require("libxmljs");

import GPXTrack from './GPXTrack.js';

export default class GPXDocument {

  /**
   * Parse the gpx xml string and store the results internally
   * @param {string} xmlString The xml string to parse
   */
  constructor(xmlString) {
    this.parsedGPX = libxmljs.parseXmlString(xmlString, {recover: true});
  }

  /**
   * Get the tracks for all tracks in the gpx file
   */
  getTracks() {
    return new Promise((resolve, reject) => {
      let tracks = this.parsedGPX.find('/ns:gpx/ns:trk', GPXDocument.GPX_NS);

      if (tracks === undefined)
        reject("Unable read tracks");

      // Use the map function to get an array with the name of each track if it exists
      resolve(tracks.map((val) => {
        return val === undefined ? undefined : new GPXTrack(val);
      }));
    });
  }
}

// The mean radius of the earth in miles
GPXDocument.MEAN_RAD_MI = 3958.7613;
GPXDocument.GPX_NS = { ns: 'http://www.topografix.com/GPX/1/1' };
