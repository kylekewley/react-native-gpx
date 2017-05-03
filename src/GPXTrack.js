
export default class GPXTrack {
  constructor(track) {
    this.track = track;
  }

  /**
   * Get the name of the track. Returns undefined if the name is not
   * defined in the gpx file
   */
  getName() {
    let nameNode = this.track.find('ns:name', GPXTrack.GPX_NS);

    if (nameNode.length === 0) return undefined;

    return nameNode[0].text();
  }

  /**
   * Returns a promise that resolves to an array of track segment lengths. All
   * lengths are returned in meters.
   */
  getSegmentLengths() {
    return new Promise((resolve, reject) => {
      let segments = this.track.find('ns:trkseg', GPXTrack.GPX_NS);

      if (segments === undefined) reject('Unable to find track segments');

      console.log('segments: ', segments.length);
      resolve(segments.map(this._getSegmentLength.bind(this)));

    });
  }

  _getSegmentLength(segment) {
    let points = segment.find('ns:trkpt', GPXTrack.GPX_NS);

    let lastCartesianPoint = undefined;
    let totalDistance = 0.0;
    points.forEach(trkpt => {
      let pointData = this._coordinateDataFromTrackPoint(trkpt);
      let currentCartesianPoint = this._toCartesianPoints(pointData[0], pointData[1], pointData[2]);

      totalDistance += this._segmentDistance(lastCartesianPoint, currentCartesianPoint);

      lastCartesianPoint = currentCartesianPoint;
    });

    return totalDistance;
  }

  /**
   * Returns an array [lat, lon, altitude]
   */
  _coordinateDataFromTrackPoint(trkpt) {
    let lat = parseFloat(trkpt.attr('lat').value());
    let lon = parseFloat(trkpt.attr('lon').value());
    let alt = 0.0;

    var altNode = trkpt.find('ns:ele', GPXTrack.GPX_NS);

    if (altNode !== undefined && altNode.length !== 0) {
      let tmp = parseFloat(altNode[0].text());
      if (!isNaN(tmp)) {
        alt = tmp;
      }
    }

    return [lat, lon, alt];
  }

  /**
   * Takes the latitude, longitude, and altitude and converts
   * them to catesian points. Returns an array [x, y, z]
   */
  _toCartesianPoints(lat, lon, alt) {
    const DEG_TO_RAD = Math.PI / 180.0;
    var cosLat = Math.cos(lat * DEG_TO_RAD);
    var sinLat = Math.sin(lat * DEG_TO_RAD);
    var cosLon = Math.cos(lon * DEG_TO_RAD);
    var sinLon = Math.sin(lon * DEG_TO_RAD);
    var rad = 6378137.0;
    var f = 1.0 / 298.257224;
    var C = 1.0 / Math.sqrt(cosLat * cosLat + (1 - f) * (1 - f) * sinLat * sinLat);
    var S = (1.0 - f) * (1.0 - f) * C;

    let x = (rad * C + alt) * cosLat * cosLon;
    let y = (rad * C + alt) * cosLat * sinLon;
    let z = (rad * S + alt) * sinLat;

    return [x, y, z];
  }

  /**
   * Takes the cartesian points in R_3 and returns a distance value.
   * returns zero if pt1 or pt2 is undefined.
   */
  _segmentDistance(pt1, pt2) {
    if (pt1 === undefined || pt2 === undefined) {
      return 0;
    }
    return Math.sqrt(Math.pow(pt2[0] - pt1[0], 2) + Math.pow(pt2[1] - pt1[1], 2) + Math.pow(pt2[2] - pt1[2], 2));
  }
}
GPXTrack.GPX_NS = { ns: 'http://www.topografix.com/GPX/1/1' };
