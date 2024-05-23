
//^const debug = require('debug')('m2mgithub');

export interface IspecificationContributor {
    contribute(note: string | undefined): void;
    closeContribution(): void;
}