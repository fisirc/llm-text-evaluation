{-# LANGUAGE DeriveGeneric #-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}

module Main where

import Data.Aeson (encode, FromJSON, ToJSON)
import Data.Text (pack)
import GHC.Generics (Generic)
import Network.Wreq (get, responseBody)
import Text.HTML.TagSoup (parseTags, Tag (TagText))
import Control.Lens ((^.))
import qualified Data.ByteString.Lazy as BL
import Control.Monad (foldM)
import qualified Data.List.NonEmpty as NEL
import qualified Data.Text as T
import qualified Data.List
import qualified Data.Char as Char
import qualified Data.Text.Lazy.Encoding as TLE
import qualified Data.Text.Lazy as TL

cleanTxt :: String -> T.Text
cleanTxt = T.replace (T.pack "\160") (T.pack "") . T.pack

data Alternative = Alternative {
    code :: Char,
    content :: T.Text
} deriving (Generic, Show, Eq)

data Question = Question {
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

sourcesUrl :: [String]
sourcesUrl = [
    "https://matematicasn.blogspot.com/2020/04/Test-de-coherencia-textual-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html",
    "https://matematicasn.blogspot.com/2019/04/oraciones-eliminadas-examen-resuelto-rv.html",
    "https://matematicasn.blogspot.com/2020/03/Test-de-eliminacion-de-oraciones-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html",
    "https://matematicasn.blogspot.com/2019/04/plan-de-redaccion-examen-resuelto-de-rv.html",
    "https://matematicasn.blogspot.com/2019/08/plan-de-redaccion-preguntas-resueltas-de-examen-de-admision-a-la-universidad-pdf.html",
    "https://matematicasn.blogspot.com/2020/04/Test-de-cohesion-textual-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html"]

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

type AppState = ([Question], ParsingQuestionState)

-- Each tag may mutate our state
process :: FSM AppState (Tag String)

process (questions, Failed s) _ = do return (questions, Failed s)
process (questions, Finished s) _ = do return (questions, Finished s)

process (questions, WaitingStart) next =
    case next of
        TagText txt | Just _ <- Data.List.stripPrefix "PREGUNTA " txt ->
            return (questions, ParsingContent (cleanTxt ""))
        _ ->
            return (questions, WaitingStart) -- not there yet

process (questions, ParsingContent content) next = do
    case next of
        TagText txt
            -- move to alternatives
            | "A) " `Data.List.isPrefixOf` txt ->
                return (questions, ParsingAlternatives content [Alternative { code = 'A', content = cleanTxt txt }])
            -- continue parsing content
            | otherwise ->
                return (questions, ParsingContent (content <> cleanTxt txt))
        _ -> return (questions, ParsingContent content) -- not there yet

process (questions, ParsingAlternatives content alternatives) next =
    case next of
        TagText txt
            -- move to explanation
            | "resoluci" `Data.List.isInfixOf` lowerStr txt ->
                return (questions, ParsingExplanation content (NEL.fromList alternatives) (cleanTxt ""))
            -- continue parsing alternatives
            | otherwise -> do
                let (code, alternative) = splitAt 3 txt
                return (questions, ParsingAlternatives content (alternatives ++ [Alternative { code = head code, content = cleanTxt alternative }]))
        _ -> return (questions, ParsingAlternatives content alternatives) -- not there yet

process (questions, ParsingExplanation content alternatives explanation) next =
    case next of
        TagText txt
            -- move to answer
            | "rpta" `Data.List.isInfixOf` lowerStr txt -> do
                let (_, code) = splitAt 9 txt
                let q = Question { questionContent = content, alternatives = alternatives, explanation = explanation, answer = head code }
                return (questions ++ [q], WaitingStart)
            -- continue parsing alternatives
            | otherwise ->
                return (questions, ParsingExplanation content alternatives (explanation <> cleanTxt txt))
        _ -> return (questions, ParsingExplanation content alternatives explanation)




main :: IO()
main = do
    -- let result :: [Question] = []

    response <- get $ head sourcesUrl

    let body = response ^. responseBody
    let output = TL.unpack (TLE.decodeUtf8 body)

    writeFile "file.txt" output

    let tags = parseTags output

    (questions, _) <- runFsm process ([], WaitingStart) tags

    let encoded = encode questions
    BL.writeFile "solution.json" encoded
    print encoded
