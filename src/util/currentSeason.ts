export const POSSIBLE_SEAONS = [2021, 2022, 2023, 2024];
let selectedSeason = POSSIBLE_SEAONS[POSSIBLE_SEAONS.length - 1];

export function getCurrentSeason(): number {
  return selectedSeason;
}

export function changeCurrentSeason(season: number): void {
  selectedSeason = season;
}
