{-# LANGUAGE DeriveGeneric #-}

module Main where

import Data.Aeson (encode, FromJSON, ToJSON)
import GHC.Generics (Generic)
import Network.Wreq (get, responseBody)
import Text.HTML.TagSoup (parseTags, Tag (TagText))
import Control.Lens ((^.))
import Data.Char (isSpace)
import Data.List (dropWhileEnd)
import Control.Monad (foldM)
import Text.Regex.Posix ((=~))
import qualified Data.ByteString.Lazy as BL
import qualified Data.List.NonEmpty as NEL
import qualified Data.Text as T
import qualified Data.List
import qualified Data.Char as Char
import qualified Data.Text.Lazy.Encoding as TLE
import qualified Data.Text.Lazy as TL

cleanTxt :: String -> T.Text
cleanTxt = T.replace (T.pack "\160") (T.pack " ") . T.pack

cleanString :: String -> String
cleanString = T.unpack . cleanTxt

trim :: String -> T.Text
trim = T.pack . dropWhileEnd isSpace . dropWhile isSpace . cleanString

trimString :: String -> String
trimString = dropWhileEnd isSpace . dropWhile isSpace

data Alternative = Alternative {
    code :: Char,
    content :: T.Text
} deriving (Generic, Show, Eq)

data Question = Question {
    task :: String,
    questionContent :: T.Text,
    alternatives :: NEL.NonEmpty Alternative,
    explanation :: T.Text,
    answer :: Char
} deriving (Generic, Show, Eq)

instance ToJSON Alternative
instance FromJSON Alternative

instance ToJSON Question
instance FromJSON Question
    -- No need to provide a parseJSON implementation.

sourcesUrl :: [(String, String)]
sourcesUrl = [
    ("sentence_ordering", "https://matematicasn.blogspot.com/2020/04/Test-de-coherencia-textual-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html"),
    ("sentence_elimination", "https://matematicasn.blogspot.com/2019/04/oraciones-eliminadas-examen-resuelto-rv.html"),
    ("sentence_elimination", "https://matematicasn.blogspot.com/2020/03/Test-de-eliminacion-de-oraciones-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html"),
    ("sentence_ordering", "https://matematicasn.blogspot.com/2019/04/plan-de-redaccion-examen-resuelto-de-rv.html"),
    ("sentence_ordering", "https://matematicasn.blogspot.com/2019/08/plan-de-redaccion-preguntas-resueltas-de-examen-de-admision-a-la-universidad-pdf.html"),
    ("sentence_ordering", "https://matematicasn.blogspot.com/2020/04/Test-de-cohesion-textual-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html")]

-- Returning an IO allow us to perform side effects on transitions
type FSM s e = s -> e -> IO s
-- s -> ParsingQuestionState
-- e -> [Tag String]
runFsm :: Foldable f => FSM s e -> s -> f e -> IO s
runFsm = foldM

type QuestionContent = T.Text
type ExplanationContent = T.Text

data ParsingQuestionState =
      WaitingStart
    | ParsingContent QuestionContent
    | ParsingAlternatives QuestionContent [Alternative]
    | ParsingExplanation QuestionContent (NEL.NonEmpty Alternative) ExplanationContent
    | Finished Question
    | Failed String
    deriving (Show, Eq)

lowerStr :: [Char] -> [Char]
lowerStr = Prelude.map Char.toLower

type AppState = (String, [Question], ParsingQuestionState)

-- Each tag may mutate our state
process :: FSM AppState (Tag String)

process (taskType, questions, Failed s) _ = do return (taskType, questions, Failed s)
process (taskType, questions, Finished s) _ = do return (taskType, questions, Finished s)

process (taskType, questions, WaitingStart) next =
    case next of
        TagText txt | Just _ <- Data.List.stripPrefix "PREGUNTA " txt ->
            return (taskType, questions, ParsingContent (cleanTxt ""))
        _ ->
            return (taskType, questions, WaitingStart) -- not there yet

process (taskType, questions, ParsingContent content) next = do
    case next of
        TagText txt
            -- move to alternatives
            | Just rest <- "a)" `Data.List.stripPrefix` (trimString . lowerStr $ txt) ->
                return (taskType, questions, ParsingAlternatives (trim (T.unpack content)) [Alternative { code = 'A', content = trim rest }])
            | Just rest <- "a." `Data.List.stripPrefix` (trimString . lowerStr $ txt) ->
                return (taskType, questions, ParsingAlternatives (trim (T.unpack content)) [Alternative { code = 'A', content = trim rest }])
            -- continue parsing content
            | otherwise ->
                return (taskType, questions, ParsingContent (content <> cleanTxt txt))
        _ -> return (taskType, questions, ParsingContent content) -- not there yet

process (taskType, questions, ParsingAlternatives content alternatives) next =
    case next of
        TagText txt
            -- move to explanation
            | "resoluci" `Data.List.isInfixOf` lowerStr txt ->
                return (taskType, questions, ParsingExplanation content (NEL.fromList alternatives) (cleanTxt ""))
            -- continue parsing alternatives
            | otherwise -> do
                let (code, alternative) = splitAt 3 txt
                if trim code /= T.pack "" then
                    return (taskType, questions, ParsingAlternatives content (alternatives ++ [Alternative { code = Char.toUpper . head $ trimString code, content = trim alternative }]))
                else
                    return (taskType, questions, ParsingAlternatives content alternatives)
        _ -> return (taskType, questions, ParsingAlternatives content alternatives) -- not there yet

process (taskType, questions, ParsingExplanation content alternatives explanation) next =
    case next of
        TagText txt
            -- parse the correct answer
            | any (\x -> x `Data.List.isInfixOf` lowerStr txt) ["rpta", "clave"] -> do
                let codeRegex = head (txt =~ "Rpta\\. ?: \"([A-E])\"?|Clave ([A-E])" :: [[String]])
                let code = (!!0) . last $ filter (not . null) codeRegex

                let q = Question { task = taskType, questionContent = content, alternatives = alternatives, explanation = trim (T.unpack explanation), answer = code }
                return (taskType, questions ++ [q], WaitingStart) -- reset again
            -- continue parsing alternatives
            | otherwise ->
                return (taskType, questions, ParsingExplanation content alternatives (explanation <> cleanTxt txt))
        _ -> return (taskType, questions, ParsingExplanation content alternatives explanation)

-- Parse all the questions for a single source
parseQuestionsForSource :: (String, String) -> IO [Question]
parseQuestionsForSource (taskType, filename) = do
    response <- get filename

    let bodyRaw = response ^. responseBody
    let body = TL.unpack (TLE.decodeUtf8 bodyRaw)
    let htmlTags = parseTags body

    (_, questions, _) <- runFsm process (taskType, [], WaitingStart) htmlTags

    return questions

main :: IO()
main = do
    questions <- mapM parseQuestionsForSource sourcesUrl
    let allQuestions = concat questions

    let encoded = encode allQuestions
    BL.writeFile "output.json" encoded
    print "Dataset output written to output.json"
