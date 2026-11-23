/**
 * Calculates Euclidean distance between two 128-dimensional face embedding vectors.
 * Standard Face-API.js / dlib threshold: distance <= 0.6 is a positive facial match.
 */
export function calculateEuclideanDistance(descriptorA: number[], descriptorB: number[]): number {
  if (!Array.isArray(descriptorA) || !Array.isArray(descriptorB)) {
    throw new Error('Face descriptors must be valid arrays of numbers');
  }

  if (descriptorA.length !== descriptorB.length) {
    throw new Error(`Descriptor length mismatch: ${descriptorA.length} vs ${descriptorB.length}`);
  }

  let sum = 0;
  for (let i = 0; i < descriptorA.length; i++) {
    const diff = descriptorA[i] - descriptorB[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculates the great-circle distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's mean radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
