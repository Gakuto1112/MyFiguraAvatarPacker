import fs from "fs";
import readline from "readline";

/**
 * READMEドキュメントの言語を示す列挙型
 */
export type FileLanguage = "en" | "jp";

/**
 * README.txtを生成するクラス
 */
class ReadmeTxtGenerator {
    /**
     * README.txtのテンプレートが置いてあるディレクトリまでのパス
     */
    private readonly TEMPLATE_DIR: string = "./templates";

    /**
     * GitHub上にあるReadmeを生成するためのテンプレートが置いてあるディレクトリまでのパス
     */
    private readonly README_TEMPLATE_DIR: string = "../../FiguraAvatarsReadmeTemplate/templates";

    /**
     * レポジトリのReadmeがあるディレクトリまでのパス
     */
    private readonly REPOSITORY_README_DIR: string = "C:/Users/gakut/AppData/Roaming/com.modrinth.theseus/profiles/Fabricバニラ/figura/avatars/ブルーアーカイブ/ベースアバター/.github";

    /**
     * 生成したREADME.txtを出力するディレクトリ
     */
    private readonly OUTPUT_DIR: string = "../out";

    /**
     * レポジトリ名
     */
    private readonly RepositoryName: string;

    /**
     * レポジトリのオーナー名
     */
    private readonly OwnerName: string;

    /**
     * リリースのタグ名
     */
    private readonly TagName: string;

    /**
     * タグのリリースが作成されたタイムスタンプ
     */
    private readonly releaseDate: Date;

    /**
     * ブランチ名
     */
    private readonly branchName: string;

    /**
     * タグ情報にブランチ名を記載するかどうか
     */
    private readonly shouldShowBranchName: boolean;

    /**
     * fetchして入手したマークダウンのキャッシュ
     */
    private readonly Caches: {[key: string]: string} = {};

    /**
     * コンストラクタ
     * @param repositoryId レポジトリのID（<オーナー名>/<レポジトリ名>）
     * @param tagName リリースのタグ名
     * @param releaseDate タグのリリースが作成されたタイムスタンプ
     * @param shouldShowBranchName タグ情報にブランチ名を記載するかどうか。`true`又は`false`が文字列で渡される。
     */
    constructor(repositoryId: string, tagName: string, releaseDate: string, shouldShowBranchName: string, branchName: string) {
        const idSprit: string[] = repositoryId.split("/");
        this.OwnerName = idSprit[0];
        this.RepositoryName = idSprit[1];
        this.TagName = tagName;
        this.releaseDate = new Date(releaseDate);
        this.releaseDate.setHours(this.releaseDate.getHours() + 9); //日本標準時（JST）に補正
        this.shouldShowBranchName = shouldShowBranchName.length == 4;
        this.branchName = branchName;
    }

    /**
     * テキストファイルをストリームで（1行ずつ）読む。
     * @param filePath 読み込み対象のファイルパス
     * @param onReadLine 1行ずつ読み込んだ際に呼ばれるコールバック関数
     */
    private async readFileWithStream(filePath: string, onReadLine: (line: string) => void): Promise<void> {
        for await(let line of readline.createInterface({input: fs.createReadStream(filePath, {encoding: "utf-8"})})) {
            await onReadLine(line);
        }
    }

    /**
     * 不要なマークダウンタグを別のものに置き換える。
     * @param input 置き換える対象のテキスト
     * @returns マークダウンタグを置き換えた後のテキスト
     */
    private replaceMarkdownTags(input: string): string {
        return input.replace(/\[([^\[\]\(\)]+)\]\([^\[\]\(\)]+\)/g, "$1").replace(/#{2}/g, "#").replace(/\*+/g, "").replace(/`/g, "\"");
    }

    /**
     * GitHubレポジトリのREADMEのテンプレート文書を読み込む
     * @param templateName 読み込むテンプレート名
     * @param fileLanguage READMEドキュメントの言語
     * @returns 読み込んだテンプレート文書の内容。一部のマークダウンタグは通常のテキストに置き換わる。
     */
    private async readReadmeTemplate(templateName: string, fileLanguage: FileLanguage): Promise<string> {
        let text: string = "";
        await this.readFileWithStream(`${this.README_TEMPLATE_DIR}/${templateName}/${fileLanguage}.md`, (line: string) => {
            text += `${this.replaceMarkdownTags(line)}\n`;
        });
        return text.substring(0, text.length - 1);
    }

    /**
     * インジェクトタグ（${<tag_name>}）が見つかった時に呼ばれる関数
     * @param tagName タグの名前
     * @param fileLanguage READMEドキュメントの言語
     * @returns タグに置き換わる文字列。返された文字列がREADMEに挿入される。
     */
    private async onInjectTagFound(tagName: string, fileLanguage: FileLanguage): Promise<string> {
        if(this.Caches[`${tagName}_${fileLanguage}`] == undefined) {
            switch(tagName) {
                case "REPOSITORY_NAME":
                    this.Caches[`REPOSITORY_NAME_${fileLanguage}`] = this.RepositoryName;
                    break;
                case "TAG_INFORMATION":
                    switch(fileLanguage) {
                        case "en":
                            this.Caches[`TAG_INFORMATION_${fileLanguage}`] = `${this.TagName} (${this.releaseDate.getUTCMonth() + 1}/${this.releaseDate.getUTCDate()}/${this.releaseDate.getUTCFullYear()})`;
                            break;
                        case "jp":
                            break;
                    }
                    this.Caches[`TAG_INFORMATION_${fileLanguage}`] = `${this.TagName} (${fileLanguage == "en" ? `${this.releaseDate.getUTCMonth() + 1}/${this.releaseDate.getUTCDate()}/${this.releaseDate.getUTCFullYear()}` : `${this.releaseDate.getUTCFullYear()}/${this.releaseDate.getUTCMonth() + 1}/${this.releaseDate.getUTCDate()}`})${this.shouldShowBranchName ? ` - ${this.branchName}` : ""}`;
                    break;
                case "AUTHOR":
                    this.Caches[`AUTHOR_${fileLanguage}`] = this.OwnerName;
                    break;
                case "DESCRIPTION":
                    let text: string = "";
                    let descriptionLineCount: number = -1;
                    await this.readFileWithStream(`${this.REPOSITORY_README_DIR}/README${fileLanguage == "en" ? "" : "_jp"}.md`, (line: string) => {
                        if(/<!--\sDESCRIPTION_START\s-->/.test(line)) descriptionLineCount = 0;
                        else if(/<!--\sDESCRIPTION_END\s-->/.test(line)) descriptionLineCount = -1;
                        if(descriptionLineCount >= 1) text += `${line}\n`;
                        descriptionLineCount = descriptionLineCount >= 0 ? descriptionLineCount + 1 : -1;
                    });
                    this.Caches[`DESCRIPTION_${fileLanguage}`] = this.replaceMarkdownTags(text).substring(0, text.length - 1);
                    break;
                case "HOW_TO_USE":
                case "NOTES":
                    this.Caches[`${tagName}_${fileLanguage}`] = await this.readReadmeTemplate(tagName.toLowerCase(), fileLanguage);
                    break;
                case "README_URL":
                    this.Caches[`README_URL_${fileLanguage}`] = `https://github.com/${this.OwnerName}/${this.RepositoryName}/blob/base/.github/README${fileLanguage == "en" ? "" : "_jp"}.md`;
                    break;
                default:
                    this.Caches[`${tagName}_${fileLanguage}`] = `\${${tagName}}`;
                    break;
            }
        }
        return this.Caches[`${tagName}_${fileLanguage}`];
    }

    /**
     * Readmeを生成する。
     * @param language Readmeが書かれている言語
     */
    private async generateReadme(language: FileLanguage): Promise<void> {
        if(!fs.existsSync(this.OUTPUT_DIR)) fs.mkdirSync(this.OUTPUT_DIR);
        const writer: fs.WriteStream = fs.createWriteStream(`${this.OUTPUT_DIR}/${language == "en" ? "README" : "お読みください"}.txt`, {encoding: "utf-8"});
        await this.readFileWithStream(`${this.TEMPLATE_DIR}/${language}.txt`, async (line: string): Promise<void> => {
            const injectTags: IterableIterator<RegExpMatchArray> = line.matchAll(/\${(\w+)}/g);
            let lineText: string = "";
            let charCount: number = 0;
            for await(const injectTag of injectTags) {
                lineText += line.substring(charCount, injectTag.index);
                charCount = injectTag.index! + injectTag[0].length;
                lineText += await this.onInjectTagFound(injectTag[1], language);
            }
            lineText += line.substring(charCount);
            lineText += "\n";
            writer.write(lineText);
        });
    }

    /**
     * メイン関数
     */
    public async main(): Promise<void> {
        console.info("Generating English readme...");
        await this.generateReadme("en");
        console.info("Generating Japanese readme...");
        await this.generateReadme("jp");
    }
}

if(require.main == module) {
    new ReadmeTxtGenerator(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6]).main();
}