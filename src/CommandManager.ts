import BaseCommand from './Commands/BaseCommand';
import {
    Broadcast,
    Ban,
    Unban,
    Tier,
    Apps,
    AddKey,
    Stock,
    AddTag,
    RemoveTag,
    Owe,
    AllOwe,
    AllIdled,
    Compare,
    Redeem,
    RedeemAll,
    Group,
    Contact,
    PrintRaw
} from './Commands/';
import FuzzySort from 'fuzzysort';
import Logger, { Levels } from './Logger';
import User from './Models/User';
import SteamUser from 'steam-user';
import SteamAPIManager from './SteamAPIManager';
import LanguageDecoder from './LanguageDecoder';

interface ClassDefinition<T> extends Function {
    new (...args: any[]): T;
}

export default class CommandWrapper {
    private SteamClient: any /*SteamUser*/;
    private CommandClasses: ClassDefinition<BaseCommand>[];
    private CommandBundle: BaseCommand[];
    private Admins: string[];
    private CommandDelimiter: string;
    private HelpMessage: string;
    private AdminHelpMessage: string;
    private Logger: Logger;
    private SteamAPIManager: SteamAPIManager;
    private LanguageDecoder: LanguageDecoder;

    constructor(
        SteamClient: any /*SteamUser*/,
        Admins: string[],
        CommandDelimiter: string,
        SteamAPIManager: SteamAPIManager,
        LanguageDecoder: LanguageDecoder
    ) {
        this.SteamClient = SteamClient;
        this.Admins = Admins;
        this.CommandDelimiter = CommandDelimiter;
        this.SteamAPIManager = SteamAPIManager;
        this.LanguageDecoder = LanguageDecoder;

        this.Logger = new Logger(this.constructor.name);

        this.CommandClasses = [
            Broadcast,
            Ban,
            Unban,
            Tier,
            Apps,
            AddKey,
            Stock,
            AddTag,
            RemoveTag,
            Owe,
            AllOwe,
            AllIdled,
            Compare,
            Redeem,
            RedeemAll,
            Group,
            Contact,
            PrintRaw
        ];

        this.Logger.log(`Command Manager Initialised`, Levels.VERBOSE);
    }

    public RegisterClasses() {
        this.Logger.log(`Registering Classes`, Levels.VERBOSE);
        this.CommandBundle = this.CommandClasses.map(
            (Ref: any) => new Ref(this.LanguageDecoder)
        );
        this.PostRegister();
    }

    private PostRegister() {
        this.Logger.log(
            `Found ${this.CommandBundle.length} Commands`,
            Levels.VERBOSE
        );

        this.Logger.log(
            `Dynamically Generating Help Documentation...`,
            Levels.VERBOSE
        );

        this.HelpMessage = this.CommandBundle.map(Command =>
            this.DocumentCommand(Command)
        )
            .filter(x => x)
            .join('\n');

        this.AdminHelpMessage = this.CommandBundle.map(Command =>
            this.DocumentCommand(Command, true)
        ).join('\n');

        this.Logger.log(`Created Help Documentation`, Levels.VERBOSE);
    }

    public async HandleInput(SteamID: string, Message: string) {
        const Split: string[] = Message.split(/[ ,]+/);
        const Delimiter: string = this.CommandDelimiter;
        const IsCommand: boolean = Message.charAt(0) === Delimiter;
        const Command: string = Split[0]
            ? Split[0].substr(Delimiter.length)
            : '';
        const Arguments: string[] = Split[0]
            ? Split.splice(Delimiter.length)
            : [];

        const CurrentUser = await User.findOne({
            SteamID64: SteamID
        });

        if (CurrentUser === null) {
            this.SteamClient.chatMessage(
                SteamID,
                `Internal Error, try adding me again!`
            );
            this.SteamClient.removeFriend(SteamID);
            return;
        }

        if (CurrentUser.Banned) {
            return this.SteamClient.chatMessage(SteamID, `You are banned.`);
        }

        await CurrentUser.UpdateInteraction();

        if (IsCommand)
            this.RouteCommand(Command.toLowerCase(), SteamID, Arguments);
        else this.SuggestCommand(Command.toLowerCase(), SteamID);
    }

    private DocumentCommand = (
        Command: BaseCommand,
        IsAdmin: boolean = false
    ) =>
        (IsAdmin && Command.IsAdmin) || (!IsAdmin && !Command.IsAdmin)
            ? `!${Command.Identifier} ${Command.ArgumentMap.map(Arg => {
                  if (Array.isArray(Arg)) return `[arg1, arg2, ...]`;
                  else if (typeof Arg === 'object')
                      return `<${typeof Arg.type()}${Arg.optional && '?'}>`;
                  else return `<Arg>`;
              }).join(' ')} -> ${Command.Description}`
            : null;

    public IsAdmin = (SteamID64: string) =>
        this.Admins.includes(SteamID64.toString());

    private RouteCommand(
        Identifier: string,
        SteamID64: string,
        Arguments?: string[]
    ) {
        if (Identifier === 'help')
            return this.SteamClient.chatMessage(
                SteamID64,
                this.IsAdmin(SteamID64)
                    ? this.AdminHelpMessage
                    : this.HelpMessage
            );

        const CommandFound = this.CommandBundle.find(
            (Command: BaseCommand) => Command.Identifier === Identifier
        );

        if (typeof CommandFound !== 'undefined') {
            this.Logger.log(
                `${SteamID64.toString()} -> !${Identifier} ${Arguments.join(
                    ' '
                )}`,
                Levels.DEBUG
            );

            if (!CommandFound.Validate(Arguments)) {
                this.SteamClient.chatMessage(SteamID64, `Invalid Usage!`);

                this.Logger.log(
                    `${SteamID64.toString()} -> Invalid Usage`,
                    Levels.DEBUG
                );

                return;
            }

            if (CommandFound.IsAdmin) {
                if (this.Admins.includes(SteamID64.toString())) {
                    CommandFound.Trigger({
                        SteamClient: this.SteamClient,
                        SteamID64,
                        Arguments,
                        SteamAPIManager: this.SteamAPIManager
                    });
                } else {
                    this.SteamClient.chatMessage(
                        SteamID64,
                        `This command is for admins only!`
                    );
                }
            } else {
                CommandFound.Trigger({
                    SteamClient: this.SteamClient,
                    SteamID64,
                    Arguments,
                    SteamAPIManager: this.SteamAPIManager
                });
            }
        } else this.SuggestCommand(Identifier, SteamID64);
    }

    private SuggestCommand(Identifier: string, SteamID64: string) {
        const PotentialCommands = FuzzySort.go(Identifier, this.CommandBundle, {
            key: 'Identifier'
        })
            .filter((Result: { score: number }) => Result.score > -2000)
            .map(
                CommandObj =>
                    `✔ ${this.CommandDelimiter}${CommandObj.obj.Identifier}`
            );

        const Message = [
            '↓ ↓ ↓',
            '',
            '★ Did you mean: ★',
            PotentialCommands.join('\n')
        ];

        if (PotentialCommands.length > 0)
            this.SteamClient.chatMessage(SteamID64, Message.join('\n'));
    }
}
