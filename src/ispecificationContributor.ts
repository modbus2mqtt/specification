export interface IspecificationContributor {
  contribute(note: string | undefined): void
  closeContribution(): void
}
