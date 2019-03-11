import BaseCommand, { ITriggerArgs } from '../BaseCommand';
import { NotImplemented } from '../../Errors';
import Logger, { Levels } from '../../Logger';

export default class Contact extends BaseCommand {
    constructor() {
        super('contact', false, []);
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