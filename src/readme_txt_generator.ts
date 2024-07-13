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
     * fetchして入手したマークダウンのキャッシュ
     */
    private readonly caches: {[key: string]: string} = {};

    /**
     * コンストラクタ
     * @param repositoryId レポジトリのID（<オーナー名>/<レポジトリ名>）
     */
    constructor(repositoryId: string) {
        console.log(repositoryId)
        const idSprit: string[] = repositoryId.split("/");
        this.OwnerName = idSprit[0];
        this.RepositoryName = idSprit[1];
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
     * GitHubレポジトリのREADMEのテンプレート文書を読み込む
     * @param templateName 読み込むテンプレート名
     * @param fileLanguage READMEドキュメントの言語
     * @returns 読み込んだテンプレート文書の内容。一部のマークダウンタグは通常のテキストに置き換わる。
     */
    private async readReadmeTemplate(templateName: string, fileLanguage: FileLanguage): Promise<string> {
        let text: string = "";
        await this.readFileWithStream(`${this.README_TEMPLATE_DIR}/${templateName}/${fileLanguage}.md`, (line: string) => {
            text += `${line.replace(/\[([^\[\]\(\)]+)\]\([^\[\]\(\)]+\)/g, "$1").replace(/#{2}/g, "#").replace(/\*+/g, "").replace(/`/g, "\"")}\n`;
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
        if(this.caches[`${tagName}_${fileLanguage}`] == undefined) {
            switch(tagName) {
                case "REPOSITORY_NAME":
                    this.caches[`REPOSITORY_NAME_${fileLanguage}`] = this.RepositoryName;
                    break;
                case "AUTHOR":
                    this.caches[`AUTHOR_${fileLanguage}`] = this.OwnerName;
                    break;
                case "HOW_TO_USE":
                case "NOTES":
                    this.caches[`${tagName}_${fileLanguage}`] = await this.readReadmeTemplate(tagName.toLowerCase(), fileLanguage);
                    break;
                case "README_URL":
                    this.caches[`README_URL_${fileLanguage}`] = `https://github.com/${this.OwnerName}/${this.RepositoryName}/blob/base/.github/README${fileLanguage == "en" ? "" : "_jp"}.md`;
                    break;
                default:
                    this.caches[`${tagName}_${fileLanguage}`] = `\${${tagName}}`;
                    break;
            }
        }
        return this.caches[`${tagName}_${fileLanguage}`];
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
    new ReadmeTxtGenerator(process.argv[2]).main();
}