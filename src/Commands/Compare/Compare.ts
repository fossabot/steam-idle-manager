import BaseCommand, { ITriggerArgs } from '../BaseCommand';
import { NotImplemented } from '../../Errors';
import Logger, { Levels } from '../../Logger';

export default class Compare extends BaseCommand {
    constructor() {
        super('compare', false, []);
        this.Logger = new Logger(this.constructor.name);
    }

    public Trigger = async ({
        SteamClient,
        SteamID64,
        Arguments,
    }: ITriggerArgs): Promise<void> => {
        throw new NotImplemented();
    };
}